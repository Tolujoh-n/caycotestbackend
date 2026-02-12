const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please add an event title']
  },
  description: String,
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  allDay: {
    type: Boolean,
    default: false
  },
  location: String,
  color: {
    type: String,
    default: '#3B82F6' // Default blue
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
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'notification', 'popup'],
      default: 'notification'
    },
    minutes: {
      type: Number,
      default: 15
    }
  }],
  recurrence: {
    frequency: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'none'
    },
    interval: {
      type: Number,
      default: 1
    },
    endDate: Date,
    count: Number
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

EventSchema.index({ companyId: 1, projectId: 1 });
EventSchema.index({ companyId: 1, teamId: 1 });
EventSchema.index({ companyId: 1, createdBy: 1 });
EventSchema.index({ companyId: 1, startDate: 1 });
EventSchema.index({ companyId: 1, endDate: 1 });

module.exports = mongoose.model('Event', EventSchema);
