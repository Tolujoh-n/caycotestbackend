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
// @desc    Mark onboarding as complete
// @access  Private
router.post('/complete', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const company = await Company.findById(req.user.companyId);
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Note: We keep user.onboardingCompleted for backward compatibility,
    // but onboarding status is now checked per-organization via UserOrganization.registrationEmailSent
    // We still set it to true here for any legacy checks, but the actual onboarding completion
    // for an organization is determined by registrationEmailSent
    if (!user.onboardingCompleted) {
      user.onboardingCompleted = true;
      await user.save();
    }

    // Check if registration email has been sent for this specific organization
    const userOrg = await UserOrganization.findOne({
      userId: user._id,
      companyId: company._id
    });

    // Send registration confirmation email with organization ID when onboarding is completed
    // Send email for each new organization, regardless of whether user completed onboarding for other organizations
    const shouldSendEmail = !userOrg || userOrg.registrationEmailSent !== true;
    
    console.log(`Onboarding complete check for user ${user._id}, company ${company._id}:`, {
      userOrgExists: !!userOrg,
      registrationEmailSent: userOrg?.registrationEmailSent,
      shouldSendEmail
    });

    if (shouldSendEmail) {
      try {
        console.log(`Sending registration email for organization ${company.organizationId} to ${user.email}`);
        const emailResult = await sendRegistrationEmail(
          user.email,
          user.firstName,
          user.lastName,
          company.name,
          company.organizationId
        );
        
        // Mark that registration email has been sent for this organization
        // Do this regardless of email success/failure to mark onboarding as complete
        if (userOrg) {
          userOrg.registrationEmailSent = true;
          userOrg.registrationEmailSentAt = new Date();
          await userOrg.save();
          console.log('✓ UserOrganization updated with registrationEmailSent = true');
        } else {
          // Create UserOrganization entry if it doesn't exist (shouldn't happen, but just in case)
          await UserOrganization.create({
            userId: user._id,
            companyId: company._id,
            role: user.role || 'Company Owner',
            status: 'active',
            registrationEmailSent: true,
            registrationEmailSentAt: new Date()
          });
          console.log('✓ UserOrganization created with registrationEmailSent = true');
        }
        
        if (!emailResult.success) {
          console.error('Failed to send registration email:', emailResult.error);
          // Don't fail onboarding completion if email fails, just log it
        } else {
          console.log('✓ Registration confirmation email sent successfully for organization:', company.organizationId);
        }
      } catch (emailError) {
        console.error('Error sending registration email:', emailError);
        // Even if email fails, mark onboarding as complete
        if (userOrg) {
          userOrg.registrationEmailSent = true;
          userOrg.registrationEmailSentAt = new Date();
          await userOrg.save();
        } else {
          await UserOrganization.create({
            userId: user._id,
            companyId: company._id,
            role: user.role || 'Company Owner',
            status: 'active',
            registrationEmailSent: true,
            registrationEmailSentAt: new Date()
          });
        }
        // Don't fail onboarding completion if email fails, just log it
      }
    } else {
      console.log(`Registration email already sent for organization ${company.organizationId}, skipping...`);
    }

    res.json({
      success: true,
      message: 'Onboarding completed'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;