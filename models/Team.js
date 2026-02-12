const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a team name']
  },
  description: String,
  color: {
    type: String,
    default: '#10B981', // Default green
    match: /^#[0-9A-F]{6}$/i
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

TeamSchema.index({ companyId: 1, name: 1 });
TeamSchema.index({ companyId: 1, owner: 1 });
TeamSchema.index({ companyId: 1, members: 1 });

module.exports = mongoose.model('Team', TeamSchema);
