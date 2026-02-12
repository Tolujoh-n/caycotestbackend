const express = require('express');
const router = express.Router();
const BoardSection = require('../models/BoardSection');
const Task = require('../models/Task');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/board-sections
// @desc    Get all board sections for project/team
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId } = req.query;
    const query = { companyId: req.user.companyId };

    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    const sections = await BoardSection.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ order: 1 });

    res.json({ success: true, data: sections });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/board-sections
// @desc    Create board section
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.createdBy = req.user.id;

    // Get max order for this context
    const query = { companyId: req.user.companyId };
    if (req.body.projectId) query.projectId = req.body.projectId;
    if (req.body.teamId) query.teamId = req.body.teamId;

    const maxOrder = await BoardSection.findOne(query).sort({ order: -1 });
    req.body.order = maxOrder ? maxOrder.order + 1 : 0;

    const section = await BoardSection.create(req.body);
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/board-sections/:id
// @desc    Update board section
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const section = await BoardSection.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    const updated = await BoardSection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/board-sections/:id
// @desc    Delete board section and move tasks to first section
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const section = await BoardSection.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Find first section in same context to move tasks to
    const query = { companyId: req.user.companyId };
    if (section.projectId) query.projectId = section.projectId;
    if (section.teamId) query.teamId = section.teamId;

    const firstSection = await BoardSection.findOne(query)
      .sort({ order: 1 })
      .where('_id').ne(section._id);

    // Move tasks to first section or delete if no other section
    if (firstSection) {
      await Task.updateMany(
        { sectionId: section._id },
        { sectionId: firstSection._id }
      );
    } else {
      // If no other section, just remove sectionId from tasks
      await Task.updateMany(
        { sectionId: section._id },
        { $unset: { sectionId: '' } }
      );
    }

    await section.deleteOne();
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
