const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotificationWithEmail } = require('../utils/notifications');

// @route   GET /api/events
// @desc    Get all events user has access to
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId
    };

    // Filter by date range if provided
    if (req.query.startDate && req.query.endDate) {
      query.$or = [
        {
          startDate: { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) }
        },
        {
          endDate: { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) }
        },
        {
          $and: [
            { startDate: { $lte: new Date(req.query.startDate) } },
            { endDate: { $gte: new Date(req.query.endDate) } }
          ]
        }
      ];
    }

    // Filter by project or team
    if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }
    if (req.query.teamId) {
      query.teamId = req.query.teamId;
    }

    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar')
      .sort({ startDate: 1 });

    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/events/:id
// @desc    Get single event
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/events
// @desc    Create event
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.createdBy = req.user.id;
    
    // Add creator as attendee if not already included
    if (!req.body.attendees) {
      req.body.attendees = [];
    }
    if (!req.body.attendees.includes(req.user.id)) {
      req.body.attendees.push(req.user.id);
    }

    const event = await Event.create(req.body);

    const populatedEvent = await Event.findById(event._id)
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar');

    // Notify attendees
    if (populatedEvent.attendees && populatedEvent.attendees.length > 0) {
      for (const attendee of populatedEvent.attendees) {
        if (attendee._id.toString() !== req.user.id) {
          await createNotificationWithEmail(
            req.user.companyId,
            attendee._id,
            'Event',
            'New Event',
            `You've been invited to "${event.title}"`,
            `/work/events/${event._id}`,
            { eventId: event._id, createdBy: req.user.id }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: populatedEvent
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is creator or attendee
    const isCreator = event.createdBy.toString() === req.user.id;
    const isAttendee = event.attendees.some(a => a.toString() === req.user.id);
    
    if (!isCreator && !isAttendee) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    req.body.updatedAt = new Date();
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar');

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (Creator only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only event creator can delete event' });
    }

    await event.deleteOne();

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
