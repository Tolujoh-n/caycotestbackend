const express = require('express');
const router = express.Router();
const multer = require('multer');
const Company = require('../models/Company');
const { protect, authorize } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

// @route   GET /api/companies/me
// @desc    Get own company
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    // Handle Super Admin case
    if (req.user.role === 'Super Admin') {
      return res.status(404).json({ 
        success: false,
        message: 'Super Admin does not have an associated company' 
      });
    }

    if (!req.user.companyId) {
      return res.status(404).json({ 
        success: false,
        message: 'User is not associated with a company' 
      });
    }

    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({ 
        success: false,
        message: 'Company not found' 
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// @route   POST /api/companies/me/logo
// @desc    Upload company logo
// @access  Private (Company Owner, Operations Manager)
router.post('/me/logo', protect, authorize('Company Owner', 'Operations Manager'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Delete old logo from Cloudinary if exists
    if (company.logo && company.logo.includes('cloudinary')) {
      try {
        const urlParts = company.logo.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(publicId);
      } catch (error) {
        console.error('Error deleting old logo:', error);
      }
    }

    // Upload new logo
    const result = await uploadImage(req.file, {
      folder: 'workloob/logos',
      transformation: [{ width: 300, height: 300, crop: 'limit' }]
    });

    company.logo = result.url;
    await company.save();

    res.json({
      success: true,
      data: {
        logo: company.logo
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/companies/me
// @desc    Update company
// @access  Private (Company Owner, Operations Manager)
router.put('/me', protect, authorize('Company Owner', 'Operations Manager'), async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const {
      name,
      industry,
      address,
      phone,
      email,
      website,
      logo,
      taxId,
      pricingRules,
      settings
    } = req.body;

    if (name) company.name = name;
    if (industry) company.industry = industry;
    if (address) company.address = { ...company.address, ...address };
    if (phone) company.phone = phone;
    if (email) company.email = email;
    if (website) company.website = website;
    if (logo) company.logo = logo;
    if (taxId) company.taxId = taxId;
    if (pricingRules) company.pricingRules = { ...company.pricingRules, ...pricingRules };
    if (settings) company.settings = { ...company.settings, ...settings };

    await company.save();

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/companies/onboarding-complete
// @desc    Mark onboarding as complete
// @access  Private
router.put('/onboarding-complete', protect, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user.id);
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