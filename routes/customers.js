const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const query = { companyId: req.user.companyId };

    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/customers/:id
// @desc    Get single customer
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    }).populate('userAccount');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // If user is a Client, only allow access to their own data
    if (req.user.role === 'Client' && customer.userAccount?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/customers
// @desc    Create customer
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    const customer = await Customer.create(req.body);

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    let customer = await Customer.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // If user is a Client, only allow access to their own data
    if (req.user.role === 'Client' && customer.userAccount?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private (Company Owner, Operations Manager)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await customer.deleteOne();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;