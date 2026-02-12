const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please add a task title']
  },
  description: String,
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
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BoardSection',
    index: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dueDate: Date,
  startDate: Date,
  endDate: Date,
  allDay: {
    type: Boolean,
    default: false
  },
  location: String,
  color: {
    type: String,
    default: '#3B82F6' // Default blue
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'In Review', 'Completed', 'Blocked'],
    default: 'Not Started'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  tags: [String],
  subtasks: [{
    title: String,
    completed: {
      type: Boolean,
      default: false
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  completedAt: Date,
  completedBy: {
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

TaskSchema.index({ companyId: 1, projectId: 1 });
TaskSchema.index({ companyId: 1, teamId: 1 });
TaskSchema.index({ companyId: 1, sectionId: 1 });
TaskSchema.index({ companyId: 1, assignedTo: 1 });
TaskSchema.index({ companyId: 1, createdBy: 1 });
TaskSchema.index({ companyId: 1, status: 1 });
TaskSchema.index({ companyId: 1, dueDate: 1 });

module.exports = mongoose.model('Task', TaskSchema);
