const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const { protect, tenantIsolation } = require('../middleware/auth');

// Generate PO number
const generatePONumber = async (companyId) => {
  const count = await PurchaseOrder.countDocuments({ companyId });
  return `PO-${String(count + 1).padStart(6, '0')}`;
};

// @route   GET /api/purchasing/orders
// @desc    Get all purchase orders
// @access  Private
router.get('/orders', protect, tenantIsolation, async (req, res) => {
  try {
    const { status, vendor, startDate, endDate } = req.query;
    const query = { companyId: req.user.companyId };

    if (status) query.status = status;
    if (vendor) query['vendor.name'] = { $regex: vendor, $options: 'i' };
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    const orders = await PurchaseOrder.find(query)
      .populate('jobId', 'jobNumber title')
      .populate('createdBy', 'firstName lastName')
      .sort({ orderDate: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/purchasing/orders/:id
// @desc    Get single purchase order
// @access  Private
router.get('/orders/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('jobId')
      .populate('createdBy', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/purchasing/orders
// @desc    Create purchase order
// @access  Private
router.post('/orders', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.poNumber = await generatePONumber(req.user.companyId);
    req.body.createdBy = req.user.id;

    // Calculate totals
    const subtotal = req.body.items.reduce((sum, item) => {
      return sum + ((item.quantity || 0) * (item.unitPrice || 0));
    }, 0);

    req.body.subtotal = subtotal;
    req.body.total = subtotal + (req.body.tax || 0) + (req.body.shipping || 0);

    const order = await PurchaseOrder.create(req.body);

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/purchasing/orders/:id
// @desc    Update purchase order
// @access  Private
router.put('/orders/:id', protect, tenantIsolation, async (req, res) => {
  try {
    let order = await PurchaseOrder.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Recalculate totals if items changed
    if (req.body.items) {
      const subtotal = req.body.items.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.unitPrice || 0));
      }, 0);
      req.body.subtotal = subtotal;
      req.body.total = subtotal + (req.body.tax !== undefined ? req.body.tax : order.tax) + 
                       (req.body.shipping !== undefined ? req.body.shipping : order.shipping);
    }

    order = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/purchasing/inventory
// @desc    Get all inventory items
// @access  Private
router.get('/inventory', protect, tenantIsolation, async (req, res) => {
  try {
    const { category, search, lowStock } = req.query;
    const query = { companyId: req.user.companyId };

    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$reorderPoint'] };
    }

    const inventory = await Inventory.find(query).sort({ name: 1 });

    res.json({
      success: true,
      count: inventory.length,
      data: inventory
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/purchasing/inventory
// @desc    Create inventory item
// @access  Private
router.post('/inventory', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    const item = await Inventory.create(req.body);

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/purchasing/inventory/:id
// @desc    Update inventory item
// @access  Private
router.put('/inventory/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const item = await Inventory.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    if (req.body.quantity !== undefined) {
      req.body.lastRestocked = new Date();
    }

    const updatedItem = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;