const mongoose = require('mongoose');

const TabConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  context: {
    type: String,
    enum: ['myTasks', 'project', 'team'],
    required: true
  },
  contextId: {
    type: mongoose.Schema.Types.ObjectId,
    // Can be projectId or teamId, or null for myTasks
    index: true
  },
  tabs: [{
    id: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    isVisible: {
      type: Boolean,
      default: true
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

TabConfigSchema.index({ companyId: 1, userId: 1, context: 1, contextId: 1 }, { unique: true });

module.exports = mongoose.model('TabConfig', TabConfigSchema);
