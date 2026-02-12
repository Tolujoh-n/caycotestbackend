const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Job = require('../models/Job');
const Customer = require('../models/Customer');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotification, notificationTemplates } = require('../utils/notifications');

// Generate invoice number
const generateInvoiceNumber = async (companyId) => {
  const count = await Invoice.countDocuments({ companyId });
  return `INV-${String(count + 1).padStart(6, '0')}`;
};

// Calculate totals
const calculateInvoiceTotals = (lineItems, taxRate = 0, discount = 0) => {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + ((item.quantity || 1) * (item.unitPrice || 0));
  }, 0);

  const afterDiscount = subtotal - discount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;

  return { subtotal, taxAmount, total };
};

// @route   GET /api/invoices
// @desc    Get all invoices
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { status, customerId, search } = req.query;
    const query = { companyId: req.user.companyId };

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(query)
      .populate('customerId', 'firstName lastName email company')
      .populate('createdBy', 'firstName lastName')
      .populate('jobId', 'jobNumber title')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/invoices/:id
// @desc    Get single invoice
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('customerId')
      .populate('createdBy', 'firstName lastName email')
      .populate('jobId');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/invoices
// @desc    Create invoice
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.invoiceNumber = await generateInvoiceNumber(req.user.companyId);
    req.body.createdBy = req.user.id;

    // Calculate totals
    const { subtotal, taxAmount, total } = calculateInvoiceTotals(
      req.body.lineItems || [],
      req.body.taxRate || 0,
      req.body.discount || 0
    );

    req.body.subtotal = subtotal;
    req.body.taxAmount = taxAmount;
    req.body.total = total;
    req.body.balance = total;
    req.body.paidAmount = 0;

    const invoice = await Invoice.create(req.body);

    // If invoice is linked to a job, update the job
    if (req.body.jobId) {
      await Job.findByIdAndUpdate(req.body.jobId, {
        invoiceId: invoice._id,
        revenue: total
      });
    }

    // Create notification for customer if they have a user account
    const customer = await Customer.findById(req.body.customerId).populate('userAccount');
    if (customer.userAccount) {
      const notification = notificationTemplates.invoiceCreated(invoice, req.user);
      await createNotification(
        req.user.companyId,
        customer.userAccount._id,
        notification.type,
        notification.title,
        notification.message,
        notification.link,
        notification.metadata
      );
    }

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/invoices/:id
// @desc    Update invoice
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    let invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Recalculate totals if line items changed
    if (req.body.lineItems || req.body.taxRate !== undefined || req.body.discount !== undefined) {
      const lineItems = req.body.lineItems || invoice.lineItems;
      const taxRate = req.body.taxRate !== undefined ? req.body.taxRate : invoice.taxRate;
      const discount = req.body.discount !== undefined ? req.body.discount : invoice.discount;

      const { subtotal, taxAmount, total } = calculateInvoiceTotals(lineItems, taxRate, discount);
      req.body.subtotal = subtotal;
      req.body.taxAmount = taxAmount;
      req.body.total = total;
      
      // Recalculate balance
      req.body.balance = total - (req.body.paidAmount !== undefined ? req.body.paidAmount : invoice.paidAmount);
    }

    // Update status based on payment
    if (req.body.paidAmount !== undefined) {
      const paidAmount = req.body.paidAmount;
      const total = req.body.total || invoice.total;
      req.body.balance = total - paidAmount;

      if (paidAmount >= total) {
        req.body.status = 'Paid';
      } else if (paidAmount > 0) {
        req.body.status = 'Partial';
      } else {
        req.body.status = req.body.status || 'Sent';
      }

      // Check if overdue
      if (invoice.dueDate && new Date() > new Date(invoice.dueDate) && req.body.status !== 'Paid') {
        req.body.status = 'Overdue';
      }
    }

    invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/invoices/:id
// @desc    Delete invoice
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await invoice.deleteOne();

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;