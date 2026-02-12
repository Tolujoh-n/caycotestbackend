const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotification, notificationTemplates } = require('../utils/notifications');

// @route   GET /api/schedules
// @desc    Get all schedules
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { startDate, endDate, assignedTo, status } = req.query;
    const query = { companyId: req.user.companyId };

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;

    const schedules = await Schedule.find(query)
      .populate('customerId', 'firstName lastName email company')
      .populate('jobId', 'jobNumber title status')
      .populate('assignedTo', 'firstName lastName email phone')
      .sort({ startTime: 1 });

    res.json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/schedules/:id
// @desc    Get single schedule
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('customerId')
      .populate('jobId')
      .populate('assignedTo', 'firstName lastName email phone');

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/schedules
// @desc    Create schedule
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    const schedule = await Schedule.create(req.body);

    // Emit socket event
    const io = req.app.get('io') || req.app.locals.io;
    if (io) {
      io.to(`company-${req.user.companyId}`).emit('schedule:created', schedule);
    }

    // Create notifications for assigned users
    if (schedule.assignedTo && schedule.assignedTo.length > 0) {
      const notification = notificationTemplates.scheduleCreated(schedule, req.user);
      for (const userId of schedule.assignedTo) {
        await createNotification(
          req.user.companyId,
          userId,
          notification.type,
          notification.title,
          notification.message,
          notification.link,
          notification.metadata
        );
      }
    }

    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/schedules/:id
// @desc    Update schedule
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    let schedule = await Schedule.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // Emit socket event
    const io = req.app.get('io') || req.app.locals.io;
    if (io) {
      io.to(`company-${req.user.companyId}`).emit('schedule:updated', schedule);
    }

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/schedules/:id
// @desc    Delete schedule
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    await schedule.deleteOne();

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;