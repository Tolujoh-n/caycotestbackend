const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: String,
  quantity: {
    type: Number,
    default: 1
  },
  unit: {
    type: String,
    default: 'ea'
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  markup: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    enum: ['Labor', 'Materials', 'Equipment', 'Subcontractors', 'Other']
  }
});

const EstimateSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  estimateNumber: {
    type: String,
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
    default: 'Draft'
  },
  lineItems: [LineItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  taxRate: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  validUntil: Date,
  notes: String,
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

EstimateSchema.index({ companyId: 1, status: 1 });
EstimateSchema.index({ companyId: 1, customerId: 1 });

module.exports = mongoose.model('Estimate', EstimateSchema);