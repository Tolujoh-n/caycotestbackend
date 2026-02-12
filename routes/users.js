const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const { protect, authorize, tenantIsolation } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

// @route   GET /api/users
// @desc    Get all users in company
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const users = await User.find({ companyId: req.user.companyId })
      .select('-password')
      .populate('roles', 'name description isSystemRole');

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update allowed fields
    const { firstName, lastName, phone, avatar, isActive } = req.body;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (isActive !== undefined && ['Company Owner', 'Operations Manager'].includes(req.user.role)) {
      user.isActive = isActive;
    }

    await user.save();

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/users/profile/avatar
// @desc    Upload profile avatar
// @access  Private
router.post('/profile/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);

    // Delete old avatar from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = user.avatar.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(publicId);
      } catch (error) {
        console.error('Error deleting old avatar:', error);
      }
    }

    // Upload new avatar
    const result = await uploadImage(req.file, {
      folder: 'workloob/avatars',
      transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }]
    });

    user.avatar = result.url;
    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/users/profile/update
// @desc    Update own profile
// @access  Private
router.put('/profile/update', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const { firstName, lastName, phone, avatar, emailNotifications } = req.body;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (emailNotifications !== undefined) user.emailNotifications = emailNotifications;

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        emailNotifications: user.emailNotifications
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/users/profile/password
// @desc    Update password
// @access  Private
router.put('/profile/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;