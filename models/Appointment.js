const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please add an appointment title']
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
  location: String,
  color: {
    type: String,
    default: '#10B981' // Default green
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
  status: {
    type: String,
    enum: ['Scheduled', 'Confirmed', 'Cancelled', 'Completed'],
    default: 'Scheduled'
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

AppointmentSchema.index({ companyId: 1, projectId: 1 });
AppointmentSchema.index({ companyId: 1, teamId: 1 });
AppointmentSchema.index({ companyId: 1, createdBy: 1 });
AppointmentSchema.index({ companyId: 1, startDate: 1 });
AppointmentSchema.index({ companyId: 1, endDate: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);
