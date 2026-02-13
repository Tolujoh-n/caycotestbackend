const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a company name']
  },
  organizationId: {
    type: String,
    unique: true,
    required: false, // Auto-generated in pre-save hook
    index: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  industry: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  phone: String,
  email: String,
  website: String,
  logo: String,
  taxId: String,
  pricingRules: {
    defaultMarkup: {
      type: Number,
      default: 0.25 // 25% default markup
    },
    laborRate: {
      type: Number,
      default: 50
    }
  },
  settings: {
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['Free', 'Basic', 'Professional', 'Enterprise'],
      default: 'Free'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
      default: 'active'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate organizationId before saving
CompanySchema.pre('save', async function(next) {
  if (!this.organizationId) {
    // Generate a unique organization ID (8 characters, alphanumeric)
    const crypto = require('crypto');
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      this.organizationId = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      // Check for uniqueness
      const existing = await this.constructor.findOne({ organizationId: this.organizationId });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return next(new Error('Failed to generate unique organization ID'));
    }
  }
  next();
});

module.exports = mongoose.model('Company', CompanySchema);