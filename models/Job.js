const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  jobNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  status: {
    type: String,
    enum: ['Quote', 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'On Hold'],
    default: 'Quote'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  location: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  startDate: Date,
  endDate: Date,
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  estimateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Estimate'
  },
  costs: {
    labor: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    materials: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    equipment: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    subcontractors: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    overhead: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    },
    total: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 }
    }
  },
  revenue: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  profitMargin: {
    type: Number,
    default: 0
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  notes: String,
  attachments: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

JobSchema.index({ companyId: 1, status: 1 });
JobSchema.index({ companyId: 1, customerId: 1 });

module.exports = mongoose.model('Job', JobSchema);