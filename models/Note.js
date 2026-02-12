const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
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
    default: ''
  },
  content: {
    type: String,
    required: [true, 'Please add note content']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [String],
  isPinned: {
    type: Boolean,
    default: false
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

NoteSchema.index({ companyId: 1, projectId: 1, createdAt: -1 });
NoteSchema.index({ companyId: 1, teamId: 1, createdAt: -1 });

module.exports = mongoose.model('Note', NoteSchema);
