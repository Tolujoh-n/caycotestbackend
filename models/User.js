const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please add an email'],
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['Super Admin', 'Company Owner', 'Operations Manager', 'Estimator', 'Accountant', 'Staff', 'Client'],
    required: true
  },
  // Support multiple roles (custom roles from Role model)
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: function() {
      return this.role !== 'Super Admin';
    }
  },
  phone: String,
  avatar: String,
  isActive: {
    type: Boolean,
    default: true
  },
  inviteToken: String,
  inviteTokenExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  emailNotifications: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Index for email (users can exist in multiple companies with same email)
// Uniqueness is enforced by UserOrganization model
UserSchema.index({ email: 1 });

module.exports = mongoose.model('User', UserSchema);