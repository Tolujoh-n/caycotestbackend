const express = require('express');
const router = express.Router();
const Milestone = require('../models/Milestone');
const { protect, tenantIsolation } = require('../middleware/auth');
const { hasPermission } = require('../utils/permissions');

// @route   GET /api/milestones
// @desc    Get milestones for project/team
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId } = req.query;
    const query = { companyId: req.user.companyId };

    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    const milestones = await Milestone.find(query)
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('completedBy', 'firstName lastName email avatar')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      count: milestones.length,
      data: milestones
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/milestones
// @desc    Create milestone
// @access  Private (work.manage permission)
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    if (!hasPermission(req.user, 'work.manage')) {
      return res.status(403).json({ message: 'Not authorized to create milestones' });
    }

    req.body.companyId = req.user.companyId;
    req.body.createdBy = req.user.id;

    const milestone = await Milestone.create(req.body);

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('createdBy', 'firstName lastName email avatar');

    res.status(201).json({
      success: true,
      data: populatedMilestone
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/milestones/:id
// @desc    Update milestone
// @access  Private (work.manage permission)
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    if (!hasPermission(req.user, 'work.manage')) {
      return res.status(403).json({ message: 'Not authorized to update milestones' });
    }

    const milestone = await Milestone.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    // If marking as completed
    if (req.body.completed && !milestone.completed) {
      req.body.completedAt = new Date();
      req.body.completedBy = req.user.id;
    } else if (!req.body.completed && milestone.completed) {
      req.body.completedAt = null;
      req.body.completedBy = null;
    }

    Object.assign(milestone, req.body);
    milestone.updatedAt = new Date();
    await milestone.save();

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('completedBy', 'firstName lastName email avatar');

    res.json({
      success: true,
      data: populatedMilestone
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/milestones/:id
// @desc    Delete milestone
// @access  Private (work.manage permission)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    if (!hasPermission(req.user, 'work.manage')) {
      return res.status(403).json({ message: 'Not authorized to delete milestones' });
    }

    const milestone = await Milestone.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    await milestone.deleteOne();

    res.json({
      success: true,
      message: 'Milestone deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
