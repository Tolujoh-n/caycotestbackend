const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotificationWithEmail } = require('../utils/notifications');

// @route   GET /api/teams
// @desc    Get all teams user has access to
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const teams = await Team.find({
      companyId: req.user.companyId,
      $or: [
        { owner: req.user.id },
        { members: req.user.id }
      ],
      isActive: true
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/teams/:id
// @desc    Get single team
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const team = await Team.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      $or: [
        { owner: req.user.id },
        { members: req.user.id }
      ]
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/teams
// @desc    Create team
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

    const team = await Team.create(req.body);

    const populatedTeam = await Team.findById(team._id)
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar');

    // Notify members
    if (populatedTeam.members && populatedTeam.members.length > 0) {
      for (const member of populatedTeam.members) {
        if (member._id.toString() !== req.user.id) {
          await createNotificationWithEmail(
            req.user.companyId,
            member._id,
            'Team',
            'Added to Team',
            `You've been added to team "${team.name}"`,
            `/work/teams/${team._id}`,
            { teamId: team._id, addedBy: req.user.id }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: populatedTeam
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const team = await Team.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check if user is owner
    const isOwner = team.owner.toString() === req.user.id;
    
    if (!isOwner) {
      return res.status(403).json({ message: 'Only team owner can update team' });
    }

    const updated = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate('members', 'firstName lastName email avatar');

    // Notify newly added members
    if (req.body.members) {
      const newMembers = req.body.members.filter(
        memberId => !team.members.some(m => m.toString() === memberId)
      );
      
      for (const memberId of newMembers) {
        await createNotificationWithEmail(
          req.user.companyId,
          memberId,
          'Team',
          'Added to Team',
          `You've been added to team "${updated.name}"`,
          `/work/teams/${updated._id}`,
          { teamId: updated._id, addedBy: req.user.id }
        );
      }
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team
// @access  Private (Owner only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const team = await Team.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only team owner can delete team' });
    }

    // Soft delete
    team.isActive = false;
    await team.save();

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
