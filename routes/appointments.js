const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotificationWithEmail } = require('../utils/notifications');

// @route   GET /api/appointments
// @desc    Get all appointments user has access to
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

    const appointments = await Appointment.find(query)
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar')
      .sort({ startDate: 1 });

    res.json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get single appointment
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/appointments
// @desc    Create appointment
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

    const appointment = await Appointment.create(req.body);

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('attendees', 'firstName lastName email avatar');

    // Notify attendees
    if (populatedAppointment.attendees && populatedAppointment.attendees.length > 0) {
      for (const attendee of populatedAppointment.attendees) {
        if (attendee._id.toString() !== req.user.id) {
          await createNotificationWithEmail(
            req.user.companyId,
            attendee._id,
            'Appointment',
            'New Appointment',
            `You've been invited to "${appointment.title}"`,
            `/work/appointments/${appointment._id}`,
            { appointmentId: appointment._id, createdBy: req.user.id }
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: populatedAppointment
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/appointments/:id
// @desc    Update appointment
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if user is creator or attendee
    const isCreator = appointment.createdBy.toString() === req.user.id;
    const isAttendee = appointment.attendees.some(a => a.toString() === req.user.id);
    
    if (!isCreator && !isAttendee) {
      return res.status(403).json({ message: 'Not authorized to update this appointment' });
    }

    req.body.updatedAt = new Date();
    const updated = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
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

// @route   DELETE /api/appointments/:id
// @desc    Delete appointment
// @access  Private (Creator only)
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only appointment creator can delete appointment' });
    }

    await appointment.deleteOne();

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
