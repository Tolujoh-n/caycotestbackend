const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  poNumber: {
    type: String,
    required: true,
    unique: true
  },
  vendor: {
    name: String,
    contact: String,
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    }
  },
  items: [{
    description: String,
    quantity: Number,
    unit: String,
    unitPrice: Number,
    total: Number,
    category: String
  }],
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Received', 'Partial', 'Completed', 'Cancelled'],
    default: 'Draft'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDelivery: Date,
  receivedDate: Date,
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
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

PurchaseOrderSchema.index({ companyId: 1, status: 1 });
PurchaseOrderSchema.index({ companyId: 1, orderDate: -1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);