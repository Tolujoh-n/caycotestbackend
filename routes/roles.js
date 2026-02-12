const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const User = require('../models/User');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/roles
// @desc    Get all roles for company
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const roles = await Role.find({ companyId: req.user.companyId })
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: roles.length,
      data: roles
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/roles/:id
// @desc    Get single role
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const role = await Role.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    }).populate('createdBy', 'firstName lastName');

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/roles
// @desc    Create role
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.createdBy = req.user.id;

    const role = await Role.create(req.body);

    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/roles/:id
// @desc    Update role
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const role = await Role.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Prevent editing system roles
    if (role.isSystemRole && req.body.permissions) {
      return res.status(400).json({ message: 'Cannot modify system role permissions' });
    }

    const updated = await Role.findByIdAndUpdate(req.params.id, req.body, {
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

// @route   DELETE /api/roles/:id
// @desc    Delete role
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const role = await Role.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return res.status(400).json({ message: 'Cannot delete system roles' });
    }

    // Check if any users are using this role
    const usersWithRole = await User.countDocuments({
      companyId: req.user.companyId,
      role: role.name
    });

    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role.`
      });
    }

    await role.deleteOne();

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/roles/:id/assign
// @desc    Assign role to user (adds to roles array, supports multiple roles)
// @access  Private
router.put('/:id/assign', protect, tenantIsolation, async (req, res) => {
  try {
    const { userId } = req.body;
    const role = await Role.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const user = await User.findOne({
      _id: userId,
      companyId: req.user.companyId
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add role to user's roles array if not already present
    if (!user.roles || !user.roles.includes(role._id)) {
      if (!user.roles) {
        user.roles = [];
      }
      user.roles.push(role._id);
      await user.save();
    }

    const updatedUser = await User.findById(userId).populate('roles', 'name description');

    res.json({
      success: true,
      message: 'Role assigned successfully',
      data: updatedUser
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/roles/:id/unassign
// @desc    Remove role from user
// @access  Private
router.put('/:id/unassign', protect, tenantIsolation, async (req, res) => {
  try {
    const { userId } = req.body;
    const role = await Role.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const user = await User.findOne({
      _id: userId,
      companyId: req.user.companyId
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove role from user's roles array
    if (user.roles && user.roles.includes(role._id)) {
      user.roles = user.roles.filter(r => r.toString() !== role._id.toString());
      await user.save();
    }

    const updatedUser = await User.findById(userId).populate('roles', 'name description');

    res.json({
      success: true,
      message: 'Role removed successfully',
      data: updatedUser
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/roles/:id/members
// @desc    Get all members assigned to a role
// @access  Private
router.get('/:id/members', protect, tenantIsolation, async (req, res) => {
  try {
    const role = await Role.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Find users with this role in their roles array
    const members = await User.find({
      companyId: req.user.companyId,
      roles: role._id
    }).select('firstName lastName email isActive avatar');

    res.json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;