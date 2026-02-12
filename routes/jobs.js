const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { protect, tenantIsolation } = require('../middleware/auth');
const { createNotification, notificationTemplates } = require('../utils/notifications');

// Generate job number
const generateJobNumber = async (companyId) => {
  const count = await Job.countDocuments({ companyId });
  return `JOB-${String(count + 1).padStart(6, '0')}`;
};

// @route   GET /api/jobs
// @desc    Get all jobs
// @access  Private
router.get('/', protect, tenantIsolation, async (req, res) => {
  try {
    const { status, customerId, assignedTo, search } = req.query;
    const query = { companyId: req.user.companyId };

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$or = [
        { jobNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const jobs = await Job.find(query)
      .populate('customerId', 'firstName lastName email company')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get single job
// @access  Private
router.get('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('customerId')
      .populate('assignedTo', 'firstName lastName email phone')
      .populate('estimateId')
      .populate('invoiceId');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // If user is Client, verify access
    if (req.user.role === 'Client') {
      const customer = await Customer.findById(job.customerId);
      if (customer.userAccount?.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/jobs
// @desc    Create job
// @access  Private
router.post('/', protect, tenantIsolation, async (req, res) => {
  try {
    req.body.companyId = req.user.companyId;
    req.body.jobNumber = await generateJobNumber(req.user.companyId);

    // Calculate total estimated cost
    const costs = req.body.costs || {};
    req.body.costs = {
      labor: costs.labor || { estimated: 0, actual: 0 },
      materials: costs.materials || { estimated: 0, actual: 0 },
      equipment: costs.equipment || { estimated: 0, actual: 0 },
      subcontractors: costs.subcontractors || { estimated: 0, actual: 0 },
      overhead: costs.overhead || { estimated: 0, actual: 0 },
      total: { estimated: 0, actual: 0 }
    };

    const estimatedTotal = 
      req.body.costs.labor.estimated +
      req.body.costs.materials.estimated +
      req.body.costs.equipment.estimated +
      req.body.costs.subcontractors.estimated +
      req.body.costs.overhead.estimated;

    req.body.costs.total.estimated = estimatedTotal;

    const job = await Job.create(req.body);

    // Emit socket event
    const io = req.app.get('io') || req.app.locals.io;
    if (io) {
      io.to(`company-${req.user.companyId}`).emit('job:created', job);
    }

    // Create notifications for assigned users
    if (job.assignedTo && job.assignedTo.length > 0) {
      const notification = notificationTemplates.jobCreated(job, req.user);
      for (const userId of job.assignedTo) {
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
      data: job
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/jobs/:id
// @desc    Update job
// @access  Private
router.put('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    let job = await Job.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // If user is Client, deny access
    if (req.user.role === 'Client') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Recalculate totals if costs are updated
    if (req.body.costs) {
      const costs = { ...job.costs, ...req.body.costs };
      const estimatedTotal = 
        (costs.labor?.estimated || 0) +
        (costs.materials?.estimated || 0) +
        (costs.equipment?.estimated || 0) +
        (costs.subcontractors?.estimated || 0) +
        (costs.overhead?.estimated || 0);

      const actualTotal = 
        (costs.labor?.actual || 0) +
        (costs.materials?.actual || 0) +
        (costs.equipment?.actual || 0) +
        (costs.subcontractors?.actual || 0) +
        (costs.overhead?.actual || 0);

      costs.total = {
        estimated: estimatedTotal,
        actual: actualTotal
      };

      req.body.costs = costs;

      // Calculate profit if revenue exists
      if (job.revenue || req.body.revenue) {
        const revenue = req.body.revenue || job.revenue;
        req.body.profit = revenue - actualTotal;
        req.body.profitMargin = revenue > 0 ? (req.body.profit / revenue) * 100 : 0;
      }
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // Emit socket event
    const io = req.app.get('io') || req.app.locals.io;
    if (io) {
      io.to(`company-${req.user.companyId}`).emit('job:updated', job);
    }

    // Create notification for assigned users if status changed
    if (req.body.status && job.assignedTo && job.assignedTo.length > 0) {
      const notification = notificationTemplates.jobUpdated(job, req.user);
      for (const userId of job.assignedTo) {
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

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete job
// @access  Private
router.delete('/:id', protect, tenantIsolation, async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.deleteOne();

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;