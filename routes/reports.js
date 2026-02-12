const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Invoice = require('../models/Invoice');
const Estimate = require('../models/Estimate');
const Customer = require('../models/Customer');
const Schedule = require('../models/Schedule');
const { protect, tenantIsolation } = require('../middleware/auth');

// @route   GET /api/reports/jobs
// @desc    Get job reports
// @access  Private
router.get('/jobs', protect, tenantIsolation, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = { companyId: req.user.companyId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (status) query.status = status;

    const jobs = await Job.find(query)
      .populate('customerId', 'firstName lastName company')
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      total: jobs.length,
      byStatus: {},
      totalRevenue: 0,
      totalCosts: 0,
      totalProfit: 0,
      profitMargin: 0
    };

    jobs.forEach(job => {
      // Status breakdown
      stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;
      
      // Financial totals
      stats.totalRevenue += job.revenue || 0;
      stats.totalCosts += job.costs?.total?.actual || job.costs?.total?.estimated || 0;
      stats.totalProfit += job.profit || 0;
    });

    if (stats.totalRevenue > 0) {
      stats.profitMargin = (stats.totalProfit / stats.totalRevenue) * 100;
    }

    res.json({
      success: true,
      data: jobs,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/invoices
// @desc    Get invoice reports
// @access  Private
router.get('/invoices', protect, tenantIsolation, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = { companyId: req.user.companyId };

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('customerId', 'firstName lastName company')
      .sort({ issueDate: -1 });

    const stats = {
      total: invoices.length,
      byStatus: {},
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0
    };

    invoices.forEach(invoice => {
      stats.byStatus[invoice.status] = (stats.byStatus[invoice.status] || 0) + 1;
      stats.totalAmount += invoice.total || 0;
      stats.paidAmount += invoice.paidAmount || 0;
      stats.outstandingAmount += invoice.balance || 0;
    });

    res.json({
      success: true,
      data: invoices,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/customers
// @desc    Get customer reports
// @access  Private
router.get('/customers', protect, tenantIsolation, async (req, res) => {
  try {
    const customers = await Customer.find({ companyId: req.user.companyId })
      .sort({ totalRevenue: -1 });

    const stats = {
      total: customers.length,
      byStatus: {},
      byType: {},
      totalRevenue: 0,
      totalJobs: 0
    };

    customers.forEach(customer => {
      stats.byStatus[customer.status] = (stats.byStatus[customer.status] || 0) + 1;
      stats.byType[customer.type] = (stats.byType[customer.type] || 0) + 1;
      stats.totalRevenue += customer.totalRevenue || 0;
      stats.totalJobs += customer.totalJobs || 0;
    });

    res.json({
      success: true,
      data: customers,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/profit-loss
// @desc    Get profit & loss report
// @access  Private
router.get('/profit-loss', protect, tenantIsolation, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { companyId: req.user.companyId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const jobs = await Job.find(query);
    const invoices = await Invoice.find(query);

    const revenue = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    
    const costs = {
      labor: 0,
      materials: 0,
      equipment: 0,
      subcontractors: 0,
      overhead: 0,
      total: 0
    };

    jobs.forEach(job => {
      const jobCosts = job.costs || {};
      costs.labor += jobCosts.labor?.actual || 0;
      costs.materials += jobCosts.materials?.actual || 0;
      costs.equipment += jobCosts.equipment?.actual || 0;
      costs.subcontractors += jobCosts.subcontractors?.actual || 0;
      costs.overhead += jobCosts.overhead?.actual || 0;
    });

    costs.total = costs.labor + costs.materials + costs.equipment + costs.subcontractors + costs.overhead;

    const profit = revenue - costs.total;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        revenue,
        costs,
        profit,
        profitMargin: profitMargin.toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;