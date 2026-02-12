const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/notes
// @desc    Get notes for project/team
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId } = req.query;
    const query = { companyId: req.user.companyId };

    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;

    const notes = await Note.find(query)
      .populate('createdBy', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: notes.length,
      data: notes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/notes
// @desc    Create note
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.createdBy = req.user.id;

    const note = await Note.create(req.body);

    const populatedNote = await Note.findById(note._id)
      .populate('createdBy', 'firstName lastName email avatar');

    res.status(201).json({
      success: true,
      data: populatedNote
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/notes/:id
// @desc    Update note
// @access  Private (Creator only)
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (note.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only note creator can update note' });
    }

    Object.assign(note, req.body);
    note.updatedAt = new Date();
    await note.save();

    const populatedNote = await Note.findById(note._id)
      .populate('createdBy', 'firstName lastName email avatar');

    res.json({
      success: true,
      data: populatedNote
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/notes/:id
// @desc    Delete note
// @access  Private (Creator only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (note.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only note creator can delete note' });
    }

    await note.deleteOne();

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
