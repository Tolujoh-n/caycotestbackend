const mongoose = require('mongoose');

// Junction table to track user-organization relationships
const UserOrganizationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['Company Owner', 'Operations Manager', 'Estimator', 'Accountant', 'Staff', 'Client'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'pending'
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure unique user-organization pairs
UserOrganizationSchema.index({ userId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model('UserOrganization', UserOrganizationSchema);
