const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const { protect } = require('../middleware/auth');
const { sendInviteEmail } = require('../config/email');
const { createNotificationWithEmail, notificationTemplates } = require('../utils/notifications');

// Generate JWT Token
const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set, using fallback. This is insecure for production!');
  }
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register company owner
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, phone } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate required fields
    if (!companyName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Create user first with temporary companyId
    const mongoose = require('mongoose');
    const tempCompanyId = new mongoose.Types.ObjectId();
    
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone: phone || undefined,
      role: 'Company Owner',
      companyId: tempCompanyId // Temporary, will be updated
    });

    // Create company with owner
    const company = await Company.create({
      name: companyName,
      email,
      phone: phone || undefined,
      owner: user._id
    });

    // Update user with correct companyId
    user.companyId = company._id;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: messages.join(', '),
        errors: error.errors 
      });
    }
    res.status(400).json({ 
      message: error.message || 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user has pending invite (must accept invite first)
    if (user.inviteToken && user.inviteTokenExpire && user.inviteTokenExpire > Date.now()) {
      return res.status(401).json({ message: 'Please accept your invitation first. Check your email for the invite link.' });
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: error.message || 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/auth/invite
// @desc    Invite user
// @access  Private (Company Owner, Operations Manager)
router.post('/invite', protect, async (req, res) => {
  try {
    const { email, role } = req.body;

    // Check if role is a system role or a custom role in the company
    const systemRoles = ['Company Owner', 'Operations Manager', 'Estimator', 'Accountant', 'Staff', 'Client'];
    const Role = require('../models/Role');
    
    let isValidRole = systemRoles.includes(role);
    
    // If not a system role, check if it's a custom role in this company
    if (!isValidRole) {
      const customRole = await Role.findOne({
        name: role,
        companyId: req.user.companyId,
        isActive: true
      });
      isValidRole = !!customRole;
    }
    
    if (!isValidRole) {
      return res.status(400).json({ message: 'Invalid role. Role must be a system role or a custom role in your company.' });
    }

    // Check if user already exists in this company
    const existingUser = await User.findOne({ 
      email,
      companyId: req.user.companyId
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists in your company' });
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpire = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Get company name
    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Create user with invite token (firstName and lastName will be set when user accepts invite)
    const user = await User.create({
      email,
      role,
      companyId: req.user.companyId,
      inviteToken,
      inviteTokenExpire,
      password: crypto.randomBytes(20).toString('hex') // Temporary password
    });

    // Send invite email
    await sendInviteEmail(email, company.name, role, inviteToken);

    // Create notification (will be available after user accepts invite)
    const notification = notificationTemplates.userInvited(email, role, company.name);
    // Note: User doesn't exist yet, so we'll create notification after they accept

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/auth/invite/:token
// @desc    Verify invite token
// @access  Public
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      inviteToken: token,
      inviteTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invitation token' });
    }

    res.json({
      success: true,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/accept-invite
// @desc    Accept invite and set password
// @access  Public
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !password) {
      return res.status(400).json({ message: 'Please provide first name, last name, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      inviteToken: token,
      inviteTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invitation token' });
    }

    // Update user with provided information
    user.password = password;
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    user.inviteToken = undefined;
    user.inviteTokenExpire = undefined;
    user.isActive = true;
    await user.save();

    // Generate token
    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('companyId');

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        phone: user.phone,
        avatar: user.avatar,
        onboardingCompleted: user.onboardingCompleted,
        emailNotifications: user.emailNotifications !== undefined ? user.emailNotifications : true
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;