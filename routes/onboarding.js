const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');
const Customer = require('../models/Customer');
const Estimate = require('../models/Estimate');
const UserOrganization = require('../models/UserOrganization');
const { protect } = require('../middleware/auth');
const { sendRegistrationEmail } = require('../config/email');

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

    // Check if onboarding is completed for THIS specific organization
    // This is based on whether registration email has been sent for this organization
    const userOrg = await UserOrganization.findOne({
      userId: user._id,
      companyId: company._id
    });

    // Onboarding is considered completed for this organization if:
    // Registration email has been sent (meaning onboarding was completed for this organization)
    // For new organizations, registrationEmailSent will be false, so onboarding is not completed
    const onboardingCompletedForOrg = userOrg?.registrationEmailSent === true;

    console.log(`Onboarding status check for user ${user._id}, company ${company._id}:`, {
      userOrgExists: !!userOrg,
      registrationEmailSent: userOrg?.registrationEmailSent,
      onboardingCompletedForOrg
    });

    res.json({
      success: true,
      data: {
        steps,
        progress,
        completedSteps,
        totalSteps,
        onboardingCompleted: onboardingCompletedForOrg
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
// @desc    Mark onboarding as complete and send registration/welcome email with Organization ID
// @access  Private
router.post('/complete', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const company = await Company.findById(req.user.companyId);
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Ensure company has organizationId (pre-save hook sets it; reload if missing for legacy data)
    if (!company.organizationId) {
      await company.save();
    }
    const organizationId = company.organizationId;
    if (!organizationId) {
      console.error('Company missing organizationId:', company._id);
    }

    // Legacy: keep user.onboardingCompleted for backward compatibility
    if (!user.onboardingCompleted) {
      user.onboardingCompleted = true;
      await user.save();
    }

    // Find or create UserOrganization for this user+company so we can track registration email
    let userOrg = await UserOrganization.findOne({
      userId: user._id,
      companyId: company._id
    });
    if (!userOrg) {
      userOrg = await UserOrganization.create({
        userId: user._id,
        companyId: company._id,
        role: user.role || 'Company Owner',
        status: 'active',
        joinedAt: new Date(),
        registrationEmailSent: false
      });
      console.log('✓ UserOrganization created for onboarding complete');
    }

    // Always try to send registration email when they complete onboarding for this org,
    // unless we already successfully sent it (so we don't send duplicates)
    const shouldSendEmail = userOrg.registrationEmailSent !== true;
    let emailSent = false;

    if (shouldSendEmail && organizationId) {
      try {
        console.log(`Sending registration email for organization ${organizationId} to ${user.email}`);
        const emailResult = await sendRegistrationEmail(
          user.email,
          user.firstName,
          user.lastName,
          company.name,
          organizationId
        );

        if (emailResult.success) {
          emailSent = true;
          console.log('✓ Registration confirmation email sent successfully for organization:', organizationId);
        } else {
          console.error('Failed to send registration email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Error sending registration email:', emailError);
      }
      // Always mark registration email as "sent" for this org so onboarding is complete and we don't send duplicates.
      // If send failed, user can use "Resend welcome email" from Settings.
      userOrg.registrationEmailSent = true;
      userOrg.registrationEmailSentAt = new Date();
      await userOrg.save();
    } else if (userOrg.registrationEmailSent === true) {
      console.log(`Registration email already sent for organization ${organizationId}, skipping.`);
    } else if (!organizationId) {
      console.error('Cannot send registration email: company has no organizationId');
      // Still mark onboarding complete so user is not stuck
      userOrg.registrationEmailSent = true;
      userOrg.registrationEmailSentAt = new Date();
      await userOrg.save();
    }

    const onboardingCompleted = userOrg.registrationEmailSent === true;

    res.json({
      success: true,
      message: 'Onboarding completed',
      emailSent,
      onboardingCompleted
    });
  } catch (error) {
    console.error('Onboarding complete error:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/onboarding/resend-welcome-email
// @desc    Resend registration/welcome email with Organization ID (e.g. if it failed on complete)
// @access  Private
router.post('/resend-welcome-email', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const company = await Company.findById(req.user.companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (!company.organizationId) {
      await company.save();
    }
    const organizationId = company.organizationId;
    if (!organizationId) {
      return res.status(400).json({ message: 'Company has no Organization ID. Please contact support.' });
    }
    const emailResult = await sendRegistrationEmail(
      user.email,
      user.firstName,
      user.lastName,
      company.name,
      organizationId
    );
    if (!emailResult.success) {
      console.error('Resend welcome email failed:', emailResult.error);
      return res.status(500).json({ message: 'Failed to send email. Please try again later.', emailSent: false });
    }
    return res.json({ success: true, message: 'Welcome email sent. Check your inbox.', emailSent: true });
  } catch (error) {
    console.error('Resend welcome email error:', error);
    return res.status(500).json({ message: error.message || 'Failed to send email' });
  }
});

module.exports = router;