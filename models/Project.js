const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a project name']
  },
  description: String,
  color: {
    type: String,
    default: '#4F46E5', // Default indigo
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
  status: {
    type: String,
    enum: ['Active', 'On Hold', 'Completed', 'Archived'],
    default: 'Active'
  },
  startDate: Date,
  dueDate: Date,
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ProjectSchema.index({ companyId: 1, name: 1 });
ProjectSchema.index({ companyId: 1, owner: 1 });
ProjectSchema.index({ companyId: 1, members: 1 });

module.exports = mongoose.model('Project', ProjectSchema);
