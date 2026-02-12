const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
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
  sku: String,
  description: String,
  category: {
    type: String,
    enum: ['Materials', 'Tools', 'Equipment', 'Supplies', 'Other'],
    default: 'Materials'
  },
  unit: {
    type: String,
    default: 'ea'
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  reorderPoint: {
    type: Number,
    default: 0
  },
  reorderQuantity: {
    type: Number,
    default: 0
  },
  unitCost: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  location: String,
  supplier: {
    name: String,
    contact: String,
    email: String,
    phone: String
  },
  lastRestocked: Date,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

InventorySchema.index({ companyId: 1, category: 1 });
InventorySchema.index({ companyId: 1, sku: 1 });

// Calculate total value before save
InventorySchema.pre('save', function(next) {
  this.totalValue = (this.quantity || 0) * (this.unitCost || 0);
  next();
});

module.exports = mongoose.model('Inventory', InventorySchema);