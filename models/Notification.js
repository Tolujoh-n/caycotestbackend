const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['Job', 'Invoice', 'Estimate', 'Schedule', 'Customer', 'System', 'Team', 'Project', 'Task', 'Event', 'Appointment'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  link: String,
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);