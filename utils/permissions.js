/**
 * Check if user has a specific permission
 * @param {Object} user - User object
 * @param {String} permission - Permission string (e.g., 'work.manage')
 * @returns {Boolean} - True if user has permission
 */
const hasPermission = (user, permission) => {
  if (!user) return false;
  
  // Super Admin has all permissions
  if (user.role === 'Super Admin') return true;
  
  // Permission matrix (matches frontend AuthContext)
  const permissions = {
    'Company Owner': ['*'], // All permissions
    'Operations Manager': [
      'jobs.view', 'jobs.create', 'jobs.edit', 'jobs.delete',
      'schedules.view', 'schedules.create', 'schedules.edit', 'schedules.delete',
      'customers.view', 'customers.create', 'customers.edit',
      'estimates.view', 'estimates.create', 'estimates.edit',
      'invoices.view', 'invoices.create', 'invoices.edit',
      'reports.view', 'users.view', 'users.invite',
      'work.view', 'work.manage',
      'inbox.view'
    ],
    'Estimator': [
      'jobs.view', 'customers.view', 'customers.create', 'customers.edit',
      'estimates.view', 'estimates.create', 'estimates.edit', 'estimates.delete',
      'work.view',
      'inbox.view'
    ],
    'Accountant': [
      'jobs.view', 'customers.view', 'invoices.view', 'invoices.create',
      'invoices.edit', 'invoices.delete', 'reports.view',
      'work.view',
      'inbox.view'
    ],
    'Staff': [
      'jobs.view', 'schedules.view', 'jobs.edit',
      'work.view',
      'inbox.view'
    ],
    'Client': [
      'jobs.view', 'invoices.view', 'schedules.view',
      'work.view',
      'inbox.view'
    ]
  };

  const userPermissions = permissions[user.role] || [];
  
  // Check if user has wildcard permission or specific permission
  if (userPermissions.includes('*') || userPermissions.includes(permission)) {
    return true;
  }

  return false;
};

module.exports = { hasPermission };
