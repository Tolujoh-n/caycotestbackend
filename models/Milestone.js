const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please add a milestone title']
  },
  description: String,
  dueDate: {
    type: Date,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

MilestoneSchema.index({ companyId: 1, projectId: 1 });
MilestoneSchema.index({ companyId: 1, teamId: 1 });
MilestoneSchema.index({ companyId: 1, completed: 1 });

module.exports = mongoose.model('Milestone', MilestoneSchema);
