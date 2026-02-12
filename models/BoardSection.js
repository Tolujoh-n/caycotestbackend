const mongoose = require('mongoose');

const BoardSectionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a section name']
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
  order: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#6B7280'
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

BoardSectionSchema.index({ companyId: 1, projectId: 1 });
BoardSectionSchema.index({ companyId: 1, teamId: 1 });

module.exports = mongoose.model('BoardSection', BoardSectionSchema);
