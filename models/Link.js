const mongoose = require('mongoose');

const LinkSchema = new mongoose.Schema({
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
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    index: true
  },
  url: {
    type: String,
    required: [true, 'Please add a URL'],
    trim: true
  },
  title: String,
  description: String,
  image: String, // Open Graph image URL
  siteName: String, // Site name from metadata
  favicon: String,
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [String],
  isKeyResource: {
    type: Boolean,
    default: false,
    index: true
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

LinkSchema.index({ companyId: 1, projectId: 1 });
LinkSchema.index({ companyId: 1, teamId: 1 });
LinkSchema.index({ companyId: 1, taskId: 1 });

module.exports = mongoose.model('Link', LinkSchema);
