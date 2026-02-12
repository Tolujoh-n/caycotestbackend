const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Job = require('../models/Job');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Estimate = require('../models/Estimate');
const Schedule = require('../models/Schedule');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics
// @access  Private
router.get('/dashboard', protect, tenantIsolation, async (req, res) => {
  try {
    // Handle Super Admin case
    if (req.user.role === 'Super Admin') {
      return res.json({
        success: true,
        data: {
          overview: {
            totalJobs: 0,
            activeJobs: 0,
            totalCustomers: 0,
            totalRevenue: 0,
            outstandingAmount: 0,
            totalProfit: 0,
            profitMargin: 0
          },
          charts: {
            revenueTrend: [],
            jobStatusDistribution: []
          },
          recentActivity: []
        }
      });
    }

    if (!req.user.companyId) {
      return res.json({
        success: true,
        data: {
          overview: {
            totalJobs: 0,
            activeJobs: 0,
            totalCustomers: 0,
            totalRevenue: 0,
            outstandingAmount: 0,
            totalProfit: 0,
            profitMargin: 0
          },
          charts: {
            revenueTrend: [],
            jobStatusDistribution: []
          },
          recentActivity: []
        }
      });
    }

    const companyId = req.user.companyId;

    // Get counts
    const [
      totalJobs,
      activeJobs,
      totalCustomers,
      totalInvoices,
      pendingInvoices,
      totalEstimates,
      scheduledJobs
    ] = await Promise.all([
      Job.countDocuments({ companyId }),
      Job.countDocuments({ companyId, status: { $in: ['Scheduled', 'In Progress'] } }),
      Customer.countDocuments({ companyId }),
      Invoice.countDocuments({ companyId }),
      Invoice.countDocuments({ companyId, status: { $in: ['Sent', 'Partial', 'Overdue'] } }),
      Estimate.countDocuments({ companyId }),
      Schedule.countDocuments({ companyId, startTime: { $gte: new Date() } })
    ]);

    // Get financial totals
    const invoices = await Invoice.find({ companyId });
    const jobs = await Job.find({ companyId });

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const outstandingAmount = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    
    const totalCosts = jobs.reduce((sum, job) => {
      return sum + (job.costs?.total?.actual || job.costs?.total?.estimated || 0);
    }, 0);

    const totalProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Get recent activity
    const recentJobs = await Job.find({ companyId })
      .populate('customerId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentInvoices = await Invoice.find({ companyId })
      .populate('customerId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get jobs by status
    const jobsByStatus = await Job.aggregate([
      { $match: { companyId: mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get revenue trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const revenueTrend = await Invoice.aggregate([
      {
        $match: {
          companyId: mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId,
          issueDate: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$issueDate' },
            month: { $month: '$issueDate' }
          },
          revenue: { $sum: '$paidAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalJobs,
          activeJobs,
          totalCustomers,
          totalInvoices,
          pendingInvoices,
          totalEstimates,
          scheduledJobs
        },
        financial: {
          totalRevenue,
          outstandingAmount,
          totalCosts,
          totalProfit,
          profitMargin: profitMargin.toFixed(2)
        },
        recentActivity: {
          jobs: recentJobs,
          invoices: recentInvoices
        },
        charts: {
          jobsByStatus,
          revenueTrend
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;