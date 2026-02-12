const express = require('express');
const router = express.Router();
const TabConfig = require('../models/TabConfig');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/tab-configs
// @desc    Get tab config for user context
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { context, contextId } = req.query;
    const query = {
      companyId: req.user.companyId,
      userId: req.user.id
    };

    if (context) query.context = context;
    if (contextId) query.contextId = contextId;

    const configs = await TabConfig.find(query).sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tab-configs
// @desc    Create or update tab config
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.userId = req.user.id;

    // Check if config exists
    const existing = await TabConfig.findOne({
      companyId: req.user.companyId,
      userId: req.user.id,
      context: req.body.context,
      contextId: req.body.contextId || null
    });

    let config;
    if (existing) {
      config = await TabConfig.findByIdAndUpdate(existing._id, req.body, {
        new: true,
        runValidators: true
      });
    } else {
      config = await TabConfig.create(req.body);
    }

    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/tab-configs/:id
// @desc    Update tab config
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const config = await TabConfig.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      userId: req.user.id
    });

    if (!config) {
      return res.status(404).json({ message: 'Tab config not found' });
    }

    const updated = await TabConfig.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
