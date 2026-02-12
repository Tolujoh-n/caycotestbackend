const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Customer = require('../models/Customer');
const Estimate = require('../models/Estimate');
const { protect } = require('../middleware/auth');

// @route   GET /api/onboarding/status
// @desc    Get onboarding status
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    // Handle Super Admin case
    if (req.user.role === 'Super Admin') {
      return res.json({
        success: true,
        data: {
          steps: {
            companyInfo: true,
            teamSetup: true,
            pricingRules: true,
            firstCustomer: true,
            firstEstimate: true
          },
          progress: 100,
          completedSteps: 5,
          totalSteps: 5,
          onboardingCompleted: true
        }
      });
    }

    if (!req.user.companyId) {
      return res.json({
        success: true,
        data: {
          steps: {
            companyInfo: false,
            teamSetup: false,
            pricingRules: false,
            firstCustomer: false,
            firstEstimate: false
          },
          progress: 0,
          completedSteps: 0,
          totalSteps: 5,
          onboardingCompleted: false
        }
      });
    }

    const user = await User.findById(req.user.id);
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.json({
        success: true,
        data: {
          steps: {
            companyInfo: false,
            teamSetup: false,
            pricingRules: false,
            firstCustomer: false,
            firstEstimate: false
          },
          progress: 0,
          completedSteps: 0,
          totalSteps: 5,
          onboardingCompleted: false
        }
      });
    }

    const steps = {
      companyInfo: !!company.name && !!company.email,
      teamSetup: false, // Will check if users exist
      pricingRules: !!company.pricingRules?.defaultMarkup,
      firstCustomer: false,
      firstEstimate: false
    };

    // Check team setup
    const teamCount = await User.countDocuments({ companyId: req.user.companyId });
    steps.teamSetup = teamCount > 1;

    // Check first customer
    const customerCount = await Customer.countDocuments({ companyId: req.user.companyId });
    steps.firstCustomer = customerCount > 0;

    // Check first estimate
    const estimateCount = await Estimate.countDocuments({ companyId: req.user.companyId });
    steps.firstEstimate = estimateCount > 0;

    const completedSteps = Object.values(steps).filter(Boolean).length;
    const totalSteps = Object.keys(steps).length;
    const progress = (completedSteps / totalSteps) * 100;

    res.json({
      success: true,
      data: {
        steps,
        progress,
        completedSteps,
        totalSteps,
        onboardingCompleted: user?.onboardingCompleted || false
      }
    });
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// @route   POST /api/onboarding/complete-step
// @desc    Mark onboarding step as complete
// @access  Private
router.post('/complete-step', protect, async (req, res) => {
  try {
    const { step } = req.body;
    const user = await User.findById(req.user.id);

    // Update onboarding status based on step
    if (step === 'companyInfo' || step === 'pricingRules') {
      // These are handled by company update
    } else if (step === 'firstCustomer' || step === 'firstEstimate') {
      // These are handled when items are created
    }

    res.json({
      success: true,
      message: 'Step completed'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/onboarding/complete
// @desc    Mark onboarding as complete
// @access  Private
router.post('/complete', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.onboardingCompleted = true;
    await user.save();

    res.json({
      success: true,
      message: 'Onboarding completed'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;