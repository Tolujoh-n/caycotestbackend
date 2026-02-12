const express = require('express');
const router = express.Router();
const Estimate = require('../models/Estimate');
const Job = require('../models/Job');
const Customer = require('../models/Customer');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotification, notificationTemplates } = require('../utils/notifications');

// Generate estimate number
const generateEstimateNumber = async (companyId) => {
  const count = await Estimate.countDocuments({ companyId });
  return `EST-${String(count + 1).padStart(6, '0')}`;
};

// Calculate totals
const calculateTotals = (lineItems, taxRate = 0, discount = 0) => {
  const subtotal = lineItems.reduce((sum, item) => {
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const withMarkup = itemTotal * (1 + (item.markup || 0) / 100);
    return sum + withMarkup;
  }, 0);

  const afterDiscount = subtotal - discount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;

  return { subtotal, taxAmount, total };
};

// @route   GET /api/estimates
// @desc    Get all estimates
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { status, customerId, search } = req.query;
    const query = { companyId: req.user.companyId };

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (search) {
      query.$or = [
        { estimateNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const estimates = await Estimate.find(query)
      .populate('customerId', 'firstName lastName email company')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: estimates.length,
      data: estimates
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/estimates/:id
// @desc    Get single estimate
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const estimate = await Estimate.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('customerId')
      .populate('createdBy', 'firstName lastName email')
      .populate('jobId');

    if (!estimate) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/estimates
// @desc    Create estimate
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.estimateNumber = await generateEstimateNumber(req.user.companyId);
    req.body.createdBy = req.user.id;

    // Calculate totals
    const { subtotal, taxAmount, total } = calculateTotals(
      req.body.lineItems || [],
      req.body.taxRate || 0,
      req.body.discount || 0
    );

    req.body.subtotal = subtotal;
    req.body.taxAmount = taxAmount;
    req.body.total = total;

    const estimate = await Estimate.create(req.body);

    res.status(201).json({
      success: true,
      data: estimate
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/estimates/:id
// @desc    Update estimate
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    let estimate = await Estimate.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!estimate) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    // Recalculate totals if line items changed
    if (req.body.lineItems || req.body.taxRate !== undefined || req.body.discount !== undefined) {
      const lineItems = req.body.lineItems || estimate.lineItems;
      const taxRate = req.body.taxRate !== undefined ? req.body.taxRate : estimate.taxRate;
      const discount = req.body.discount !== undefined ? req.body.discount : estimate.discount;

      const { subtotal, taxAmount, total } = calculateTotals(lineItems, taxRate, discount);
      req.body.subtotal = subtotal;
      req.body.taxAmount = taxAmount;
      req.body.total = total;
    }

    estimate = await Estimate.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/estimates/:id/accept
// @desc    Accept estimate and create job
// @access  Private
router.post('/:id/accept', protect, tenantIsolation, async (req, res) => {
  try {
    const estimate = await Estimate.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!estimate) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    // Update estimate status
    estimate.status = 'Accepted';
    await estimate.save();

    // Create job from estimate
    const Job = require('../models/Job');
    const generateJobNumber = async (companyId) => {
      const count = await Job.countDocuments({ companyId });
      return `JOB-${String(count + 1).padStart(6, '0')}`;
    };

    const job = await Job.create({
      companyId: estimate.companyId,
      jobNumber: await generateJobNumber(estimate.companyId),
      customerId: estimate.customerId,
      title: estimate.title,
      description: estimate.description,
      status: 'Scheduled',
      estimateId: estimate._id,
      costs: {
        labor: { estimated: 0, actual: 0 },
        materials: { estimated: 0, actual: 0 },
        equipment: { estimated: 0, actual: 0 },
        subcontractors: { estimated: 0, actual: 0 },
        overhead: { estimated: 0, actual: 0 },
        total: { estimated: estimate.total, actual: 0 }
      },
      revenue: estimate.total
    });

    // Link job to estimate
    estimate.jobId = job._id;
    await estimate.save();

    // Create notification
    const notification = notificationTemplates.estimateAccepted(estimate, req.user);
    await createNotification(
      req.user.companyId,
      req.user.id,
      notification.type,
      notification.title,
      notification.message,
      notification.link,
      notification.metadata
    );

    res.json({
      success: true,
      data: { estimate, job }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/estimates/:id
// @desc    Delete estimate
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const estimate = await Estimate.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!estimate) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    await estimate.deleteOne();

    res.json({
      success: true,
      message: 'Estimate deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;