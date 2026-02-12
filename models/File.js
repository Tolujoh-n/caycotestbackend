const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
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
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: String, // Local file path (legacy)
  cloudinaryUrl: String, // Cloudinary URL
  cloudinaryPublicId: String, // Cloudinary public ID for deletion
  mimeType: String,
  size: {
    type: Number,
    required: true
  },
  description: String,
  tags: [String],
  isKeyResource: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

FileSchema.index({ companyId: 1, projectId: 1 });
FileSchema.index({ companyId: 1, teamId: 1 });
FileSchema.index({ companyId: 1, taskId: 1 });
FileSchema.index({ companyId: 1, uploadedBy: 1 });

module.exports = mongoose.model('File', FileSchema);
