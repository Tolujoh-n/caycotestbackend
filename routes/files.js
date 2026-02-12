const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const { protect, tenantIsolation } = require('../middleware/auth');
const { uploadFile, deleteFile } = require('../utils/cloudinary');

// Configure multer for file uploads (memory storage for Cloudinary)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (Cloudinary supports larger files)
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// @route   GET /api/files
// @desc    Get files for project/team/task
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId, taskId, isKeyResource } = req.query;
    const query = { companyId: req.user.companyId };

    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;
    if (taskId) query.taskId = taskId;
    if (isKeyResource !== undefined) {
      query.isKeyResource = isKeyResource === 'true' || isKeyResource === true;
    }

    const files = await File.find(query)
      .populate('uploadedBy', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: files.length,
      data: files
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/files
// @desc    Upload file to Cloudinary
// @access  Private
router.post('/', protect, tenantIsolation, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Determine folder based on context
    let folder = 'workloob/files';
    if (req.body.projectId) folder = `workloob/files/projects/${req.body.projectId}`;
    else if (req.body.teamId) folder = `workloob/files/teams/${req.body.teamId}`;
    else if (req.body.taskId) folder = `workloob/files/tasks/${req.body.taskId}`;

    // Upload to Cloudinary
    const cloudinaryResult = await uploadFile(req.file, {
      folder: folder,
      public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`
    });

    const fileData = {
      companyId: req.user.companyId,
      uploadedBy: req.user.id,
      originalName: req.file.originalname,
      fileName: req.file.originalname, // Keep original name
      cloudinaryUrl: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      mimeType: req.file.mimetype,
      size: cloudinaryResult.bytes || req.file.size
    };

    // Ensure IDs are strings, not objects
    if (req.body.projectId) {
      fileData.projectId = typeof req.body.projectId === 'string' ? req.body.projectId : String(req.body.projectId);
    }
    if (req.body.teamId) {
      fileData.teamId = typeof req.body.teamId === 'string' ? req.body.teamId : String(req.body.teamId);
    }
    if (req.body.taskId) {
      fileData.taskId = typeof req.body.taskId === 'string' ? req.body.taskId : String(req.body.taskId);
    }
    if (req.body.description) fileData.description = req.body.description;
    if (req.body.isKeyResource !== undefined) {
      fileData.isKeyResource = req.body.isKeyResource === 'true' || req.body.isKeyResource === true;
    }
    if (req.body.tags) {
      fileData.tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
    }

    const file = await File.create(fileData);

    const populatedFile = await File.findById(file._id)
      .populate('uploadedBy', 'firstName lastName email avatar');

    res.status(201).json({
      success: true,
      data: populatedFile
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(400).json({ message: error.message || 'Failed to upload file' });
  }
});

// @route   GET /api/files/:id/download
// @desc    Get file URL (redirects to Cloudinary or local file)
// @access  Private
router.get('/:id/download', protect, tenantIsolation, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // If Cloudinary URL exists, redirect to it
    if (file.cloudinaryUrl) {
      return res.redirect(file.cloudinaryUrl);
    }

    // Fallback to local file (legacy support)
    if (file.filePath && fs.existsSync(file.filePath)) {
      return res.download(file.filePath, file.originalName);
    }

    return res.status(404).json({ message: 'File not found on server' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/files/:id
// @desc    Delete file
// @access  Private (Uploader only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only file uploader can delete file' });
    }

    // Delete from Cloudinary if exists
    if (file.cloudinaryPublicId) {
      try {
        await deleteFile(file.cloudinaryPublicId, file.mimeType?.startsWith('image/') ? 'image' : 'raw');
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete local file if exists (legacy support)
    if (file.filePath && fs.existsSync(file.filePath)) {
      try {
        fs.unlinkSync(file.filePath);
      } catch (error) {
        console.error('Error deleting local file:', error);
      }
    }

    await file.deleteOne();

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
