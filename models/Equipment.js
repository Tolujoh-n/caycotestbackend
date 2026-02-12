const mongoose = require('mongoose');

const MaintenanceRecordSchema = new mongoose.Schema({
  date: Date,
  type: {
    type: String,
    enum: ['Maintenance', 'Repair', 'Inspection', 'Service'],
    required: true
  },
  description: String,
  cost: {
    type: Number,
    default: 0
  },
  performedBy: String,
  nextServiceDate: Date,
  notes: String
});

const EquipmentSchema = new mongoose.Schema({
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
  equipmentNumber: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Vehicle', 'Machinery', 'Tool', 'Other'],
    default: 'Other'
  },
  make: String,
  model: String,
  year: Number,
  serialNumber: String,
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance', 'Repair', 'Retired'],
    default: 'Active'
  },
  purchaseDate: Date,
  purchasePrice: {
    type: Number,
    default: 0
  },
  currentValue: {
    type: Number,
    default: 0
  },
  location: String,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  maintenanceSchedule: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'As Needed'],
    default: 'As Needed'
  },
  lastMaintenance: Date,
  nextMaintenance: Date,
  maintenanceRecords: [MaintenanceRecordSchema],
  totalMaintenanceCost: {
    type: Number,
    default: 0
  },
  hoursUsed: {
    type: Number,
    default: 0
  },
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

EquipmentSchema.index({ companyId: 1, status: 1 });
EquipmentSchema.index({ companyId: 1, type: 1 });

module.exports = mongoose.model('Equipment', EquipmentSchema);