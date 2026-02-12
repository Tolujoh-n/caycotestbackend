const express = require('express');
const router = express.Router();
const multer = require('multer');
const Message = require('../models/Message');
const File = require('../models/File');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotificationWithEmail } = require('../utils/notifications');
const { uploadFile } = require('../utils/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

// @route   GET /api/messages
// @desc    Get messages for project/team/task
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { projectId, teamId, taskId, limit = 50 } = req.query;
    const query = { companyId: req.user.companyId };

    if (projectId) query.projectId = projectId;
    if (teamId) query.teamId = teamId;
    if (taskId) query.taskId = taskId;

    const messages = await Message.find(query)
      .populate('sender', 'firstName lastName email avatar')
      .populate('mentions', 'firstName lastName email avatar')
      .populate('attachments')
      .populate('isRead.user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Mark messages as read for current user when viewing
    const unreadMessages = messages.filter(msg => {
      if (msg.sender._id.toString() === req.user.id) return false; // Don't mark own messages
      return !msg.isRead.some(read => read.user._id.toString() === req.user.id);
    });

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessages.map(m => m._id) } },
        { $push: { isRead: { user: req.user.id, readAt: new Date() } } }
      );
    }

    // Count unread messages for current user
    const unreadCount = await Message.countDocuments({
      ...query,
      sender: { $ne: req.user.id },
      $or: [
        { isRead: { $size: 0 } },
        { 'isRead.user': { $ne: req.user.id } }
      ]
    });

    res.json({
      success: true,
      count: messages.length,
      unreadCount,
      data: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/messages
// @desc    Create message (with optional file attachments)
// @access  Private
router.post('/', protect, tenantIsolation, upload.array('attachments', 10), async (req, res) => {
  try {
    // Validate that either content or files are provided
    const content = req.body.content || '';
    const hasContent = content.trim().length > 0;
    const hasFiles = req.files && req.files.length > 0;
    
    if (!hasContent && !hasFiles) {
      return res.status(400).json({ message: 'Message must have content or attachments' });
    }

    const messageData = {
      companyId: req.user.companyId,
      sender: req.user.id,
      content: content || ''
    };

    // Handle file uploads
    const attachmentIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let folder = 'workloob/files/messages';
        if (req.body.projectId) folder = `workloob/files/messages/projects/${req.body.projectId}`;
        else if (req.body.teamId) folder = `workloob/files/messages/teams/${req.body.teamId}`;
        else if (req.body.taskId) folder = `workloob/files/messages/tasks/${req.body.taskId}`;

        const cloudinaryResult = await uploadFile(file, {
          folder: folder,
          public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`
        });

        const fileData = {
          companyId: req.user.companyId,
          uploadedBy: req.user.id,
          originalName: file.originalname,
          fileName: file.originalname,
          cloudinaryUrl: cloudinaryResult.url,
          cloudinaryPublicId: cloudinaryResult.public_id,
          mimeType: file.mimetype,
          size: cloudinaryResult.bytes || file.size
        };

        if (req.body.projectId) {
          fileData.projectId = req.body.projectId;
          messageData.projectId = req.body.projectId;
        }
        if (req.body.teamId) {
          fileData.teamId = req.body.teamId;
          messageData.teamId = req.body.teamId;
        }
        if (req.body.taskId) {
          fileData.taskId = req.body.taskId;
          messageData.taskId = req.body.taskId;
        }

        const uploadedFile = await File.create(fileData);
        attachmentIds.push(uploadedFile._id);
      }
    }

    // Add existing attachment IDs if provided
    if (req.body.attachmentIds) {
      const existingIds = Array.isArray(req.body.attachmentIds) 
        ? req.body.attachmentIds 
        : JSON.parse(req.body.attachmentIds);
      attachmentIds.push(...existingIds);
    }

    if (attachmentIds.length > 0) {
      messageData.attachments = attachmentIds;
    }

    const message = await Message.create(messageData);

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName email avatar')
      .populate('mentions', 'firstName lastName email avatar')
      .populate('attachments');

    // Notify mentioned users
    if (populatedMessage.mentions && populatedMessage.mentions.length > 0) {
      for (const mention of populatedMessage.mentions) {
        if (mention._id.toString() !== req.user.id) {
          let link = '/work';
          if (req.body.projectId) link = `/work/projects/${req.body.projectId}`;
          if (req.body.teamId) link = `/work/teams/${req.body.teamId}`;
          if (req.body.taskId) link = `/work/tasks/${req.body.taskId}`;

          await createNotificationWithEmail(
            req.user.companyId,
            mention._id,
            'Message',
            'You were mentioned',
            `${req.user.firstName} ${req.user.lastName} mentioned you in a message`,
            link,
            { messageId: message._id, mentionedBy: req.user.id }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/messages/:id
// @desc    Update message (pin, reactions)
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can update content
    if (req.body.content && message.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only message sender can edit content' });
    }

    const updated = await Message.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('sender', 'firstName lastName email avatar')
      .populate('mentions', 'firstName lastName email avatar')
      .populate('attachments');

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete message
// @access  Private (Sender only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only message sender can delete message' });
    }

    await message.deleteOne();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
