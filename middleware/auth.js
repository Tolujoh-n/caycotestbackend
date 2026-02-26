const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserOrganization = require('../models/UserOrganization');

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    try {
      const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';
      const decoded = jwt.verify(token, secret);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Use per-organization role when user has a company (not Super Admin)
      if (req.user.role !== 'Super Admin' && req.user.companyId) {
        const userOrg = await UserOrganization.findOne({
          userId: req.user._id,
          companyId: req.user.companyId,
          status: 'active'
        });
        if (userOrg) {
          req.user.role = userOrg.role;
        }
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Tenant isolation - ensure user can only access their company's data
exports.tenantIsolation = (req, res, next) => {
  if (req.user.role === 'Super Admin') {
    return next(); // Super Admin can access all companies
  }

  if (!req.user.companyId) {
    return res.status(403).json({ message: 'User must be associated with a company' });
  }

  // Add companyId to query if not already present
  if (req.query && !req.query.companyId) {
    req.query.companyId = req.user.companyId.toString();
  }

  // Set companyId for POST/PUT requests
  if (req.body && !req.body.companyId) {
    req.body.companyId = req.user.companyId;
  }

  next();
};