const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const UserOrganization = require('../models/UserOrganization');
const { protect } = require('../middleware/auth');
const { sendInviteEmail, sendForgotOrgIdEmail, sendPasswordResetEmail } = require('../config/email');
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

    // Note: Users can now belong to multiple organizations, so we allow registration
    // even if the email exists (they'll just create a new organization)

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

    // Create company with owner (organizationId will be auto-generated)
    const company = await Company.create({
      name: companyName,
      email,
      phone: phone || undefined,
      owner: user._id
    });

    // Update user with correct companyId
    user.companyId = company._id;
    await user.save();

    // Create UserOrganization entry
    await UserOrganization.create({
      userId: user._id,
      companyId: company._id,
      role: 'Company Owner',
      status: 'active',
      joinedAt: new Date()
    });

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
        companyId: user.companyId,
        organizationId: company.organizationId
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
// @desc    Login user (requires organizationId)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { organizationId, email, password } = req.body;

    // Validate required fields
    if (!organizationId || !email || !password) {
      return res.status(400).json({ message: 'Please provide organization ID, email, and password' });
    }

    // Find company by organizationId
    const company = await Company.findOne({ organizationId: organizationId.toUpperCase() });
    if (!company) {
      return res.status(401).json({ message: 'Invalid organization ID' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user belongs to this organization
    const userOrg = await UserOrganization.findOne({
      userId: user._id,
      companyId: company._id,
      status: 'active'
    });

    if (!userOrg) {
      return res.status(401).json({ message: 'You are not a member of this organization' });
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

    // Update user's current companyId for backward compatibility
    user.companyId = company._id;
    await user.save({ validateBeforeSave: false });

    // Generate token (include companyId in token payload for context)
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: userOrg.role,
        companyId: company._id,
        organizationId: company.organizationId
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

    // Check if user already exists in this company via UserOrganization
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const existingUserOrg = await UserOrganization.findOne({
        userId: existingUser._id,
        companyId: req.user.companyId,
        status: { $in: ['active', 'pending'] }
      });
      if (existingUserOrg) {
        return res.status(400).json({ message: 'User with this email already exists in your company' });
      }
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpire = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Get company
    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Create or get user
    let user = existingUser;
    if (!user) {
      user = await User.create({
        email,
        role,
        companyId: req.user.companyId,
        inviteToken,
        inviteTokenExpire,
        password: crypto.randomBytes(20).toString('hex') // Temporary password
      });
    } else {
      // Update existing user with invite token
      user.inviteToken = inviteToken;
      user.inviteTokenExpire = inviteTokenExpire;
      user.companyId = req.user.companyId;
      await user.save({ validateBeforeSave: false });
    }

    // Create UserOrganization entry
    await UserOrganization.create({
      userId: user._id,
      companyId: req.user.companyId,
      role,
      status: 'pending',
      invitedBy: req.user.id
    });

    // Send invite email with organization ID
    const emailResult = await sendInviteEmail(email, company.name, role, inviteToken, company.organizationId);
    
    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      // Still return success to user, but log the error
      // The user was created and can be invited again if needed
    }

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

    // Update UserOrganization status to active
    const userOrg = await UserOrganization.findOne({
      userId: user._id,
      companyId: user.companyId
    });
    if (userOrg) {
      userOrg.status = 'active';
      userOrg.joinedAt = new Date();
      await userOrg.save();
    } else {
      // Create UserOrganization entry if it doesn't exist
      await UserOrganization.create({
        userId: user._id,
        companyId: user.companyId,
        role: user.role,
        status: 'active',
        joinedAt: new Date()
      });
    }

    // Get company for organizationId
    const company = await Company.findById(user.companyId);

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
        companyId: user.companyId,
        organizationId: company?.organizationId
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/auth/forgot-organization-id
// @desc    Request organization IDs for an email
// @access  Public
router.post('/forgot-organization-id', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user and verify password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get all organizations user belongs to
    const userOrgs = await UserOrganization.find({ userId: user._id, status: 'active' })
      .populate('companyId');

    if (userOrgs.length === 0) {
      return res.status(404).json({ message: 'No organizations found for this account' });
    }

    // Send email with organization IDs
    const emailResult = await sendForgotOrgIdEmail(email, userOrgs.map(uo => ({
      name: uo.companyId.name,
      organizationId: uo.companyId.organizationId,
      role: uo.role
    })));

    if (!emailResult.success) {
      console.error('Failed to send organization ID email:', emailResult.error);
      return res.status(500).json({ 
        message: 'Failed to send email. Please contact support or try again later.' 
      });
    }

    res.json({
      success: true,
      message: 'Organization IDs have been sent to your email'
    });
  } catch (error) {
    console.error('Forgot organization ID error:', error);
    res.status(500).json({ message: error.message || 'Failed to process request' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, organizationId } = req.body;

    if (!email || !organizationId) {
      return res.status(400).json({ message: 'Please provide email and organization ID' });
    }

    // Find company by organizationId
    const company = await Company.findOne({ organizationId: organizationId.toUpperCase() });
    if (!company) {
      return res.status(404).json({ message: 'Invalid organization ID' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Check if user belongs to this organization
    const userOrg = await UserOrganization.findOne({
      userId: user._id,
      companyId: company._id,
      status: 'active'
    });

    if (!userOrg) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    // Send reset email
    const emailResult = await sendPasswordResetEmail(email, company.name, resetToken, company.organizationId);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Reset the token since email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ 
        message: 'Failed to send reset email. Please try again later.' 
      });
    }

    res.json({
      success: true,
      message: 'Password reset link has been sent to your email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: error.message || 'Failed to process request' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Please provide reset token and new password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Hash token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Get company for organizationId
    const company = await Company.findById(user.companyId);

    // Generate token for automatic login
    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      message: 'Password reset successful',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        organizationId: company?.organizationId
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message || 'Failed to reset password' });
  }
});

// @route   DELETE /api/auth/user/:userId
// @desc    Delete user from organization
// @access  Private (Company Owner, Operations Manager)
router.delete('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    // Check permissions
    const userOrg = await UserOrganization.findOne({
      userId: currentUser.id,
      companyId: currentUser.companyId,
      status: 'active'
    });

    if (!userOrg || (userOrg.role !== 'Company Owner' && userOrg.role !== 'Operations Manager')) {
      return res.status(403).json({ message: 'Not authorized to delete users' });
    }

    // Get user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user belongs to same organization
    const deleteUserOrg = await UserOrganization.findOne({
      userId: userId,
      companyId: currentUser.companyId
    });

    if (!deleteUserOrg) {
      return res.status(404).json({ message: 'User not found in this organization' });
    }

    // Prevent deleting yourself
    if (userId === currentUser.id) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }

    // Prevent deleting company owner
    if (deleteUserOrg.role === 'Company Owner') {
      return res.status(400).json({ message: 'Cannot delete company owner' });
    }

    // Remove user from organization (soft delete by setting status to inactive)
    deleteUserOrg.status = 'inactive';
    await deleteUserOrg.save();

    // If user has no other active organizations, deactivate the user account
    const otherOrgs = await UserOrganization.find({
      userId: userId,
      status: 'active',
      companyId: { $ne: currentUser.companyId }
    });

    if (otherOrgs.length === 0) {
      userToDelete.isActive = false;
      userToDelete.companyId = undefined;
      await userToDelete.save({ validateBeforeSave: false });
    } else {
      // Update companyId to another active organization
      userToDelete.companyId = otherOrgs[0].companyId;
      await userToDelete.save({ validateBeforeSave: false });
    }

    res.json({
      success: true,
      message: 'User removed from organization successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete user' });
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