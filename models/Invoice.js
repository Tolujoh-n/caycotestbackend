const mongoose = require('mongoose');

const InvoiceLineItemSchema = new mongoose.Schema({
  description: String,
  quantity: {
    type: Number,
    default: 1
  },
  unit: String,
  unitPrice: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  }
});

const InvoiceSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
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
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Paid', 'Partial', 'Overdue', 'Cancelled'],
    default: 'Draft'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: Date,
  lineItems: [InvoiceLineItemSchema],
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
  paidAmount: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },
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

InvoiceSchema.index({ companyId: 1, status: 1 });
InvoiceSchema.index({ companyId: 1, customerId: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);