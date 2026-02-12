const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Task = require('../models/Task');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotificationWithEmail } = require('../utils/notifications');

// @route   GET /api/projects
// @desc    Get all projects user has access to
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId,
      $or: [
        { owner: req.user.id },
        { members: req.user.id },
        { isPublic: true }
      ]
    };

    const projects = await Project.find(query)
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      $or: [
        { owner: req.user.id },
        { members: req.user.id },
        { isPublic: true }
      ]
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/projects
// @desc    Create project
// @access  Private (Company Owner, Operations Manager)
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.owner = req.user.id;
    
    // Add creator as member if not already included
    if (!req.body.members) {
      req.body.members = [];
    }
    if (!req.body.members.includes(req.user.id)) {
      req.body.members.push(req.user.id);
    }

    const project = await Project.create(req.body);

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar');

    // Notify members
    if (populatedProject.members && populatedProject.members.length > 0) {
      for (const member of populatedProject.members) {
        if (member._id.toString() !== req.user.id) {
          await createNotificationWithEmail(
            req.user.companyId,
            member._id,
            'Project',
            'Added to Project',
            `You've been added to project "${project.name}"`,
            `/work/projects/${project._id}`,
            { projectId: project._id, addedBy: req.user.id }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: populatedProject
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is owner or member
    const isOwner = project.owner.toString() === req.user.id;
    const isMember = project.members.some(m => m.toString() === req.user.id);
    
    if (!isOwner && !isMember && !project.isPublic) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }

    // Only owner can change certain fields
    if (!isOwner && (req.body.owner || req.body.members || req.body.isPublic)) {
      return res.status(403).json({ message: 'Only project owner can modify these settings' });
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar');

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private (Owner only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only project owner can delete project' });
    }

    // Delete related tasks
    await Task.deleteMany({ projectId: req.params.id });

    await project.deleteOne();

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
