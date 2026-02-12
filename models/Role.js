const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  resource: {
    type: String,
    required: true
  },
  actions: [{
    type: String,
    enum: ['view', 'create', 'edit', 'delete', 'manage']
  }]
});

const RoleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  permissions: [PermissionSchema],
  isSystemRole: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

RoleSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', RoleSchema);