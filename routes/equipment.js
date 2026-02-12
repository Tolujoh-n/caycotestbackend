const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');
const { protect, tenantIsolation } = require('../middleware/auth');

// Generate equipment number
const generateEquipmentNumber = async (companyId) => {
  const count = await Equipment.countDocuments({ companyId });
  return `EQ-${String(count + 1).padStart(6, '0')}`;
};

// @route   GET /api/equipment
// @desc    Get all equipment
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { status, type, assignedTo, search } = req.query;
    const query = { companyId: req.user.companyId };

    if (status) query.status = status;
    if (type) query.type = type;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { equipmentNumber: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const equipment = await Equipment.find(query)
      .populate('assignedTo', 'firstName lastName')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: equipment.length,
      data: equipment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/equipment/:id
// @desc    Get single equipment
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const equipment = await Equipment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    }).populate('assignedTo', 'firstName lastName email phone');

    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/equipment
// @desc    Create equipment
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.equipmentNumber = await generateEquipmentNumber(req.user.companyId);

    const equipment = await Equipment.create(req.body);

    res.status(201).json({
      success: true,
      data: equipment
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/equipment/:id
// @desc    Update equipment
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const equipment = await Equipment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    const updated = await Equipment.findByIdAndUpdate(req.params.id, req.body, {
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

// @route   POST /api/equipment/:id/maintenance
// @desc    Add maintenance record
// @access  Private
router.post('/:id/maintenance', protect, tenantIsolation, async (req, res) => {
  try {
    const equipment = await Equipment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    const maintenanceRecord = {
      date: req.body.date || new Date(),
      type: req.body.type,
      description: req.body.description,
      cost: req.body.cost || 0,
      performedBy: req.body.performedBy,
      nextServiceDate: req.body.nextServiceDate,
      notes: req.body.notes
    };

    equipment.maintenanceRecords.push(maintenanceRecord);
    equipment.totalMaintenanceCost += maintenanceRecord.cost;
    equipment.lastMaintenance = maintenanceRecord.date;
    if (maintenanceRecord.nextServiceDate) {
      equipment.nextMaintenance = maintenanceRecord.nextServiceDate;
    }

    await equipment.save();

    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/equipment/:id
// @desc    Delete equipment
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const equipment = await Equipment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!equipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    await equipment.deleteOne();

    res.json({
      success: true,
      message: 'Equipment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;