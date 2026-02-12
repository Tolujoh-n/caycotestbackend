const Notification = require('../models/Notification');
const { sendEmail } = require('../config/email');

// Create notification helper
const createNotification = async (companyId, userId, type, title, message, link, metadata = {}) => {
  try {
    const notification = await Notification.create({
      companyId,
      userId,
      type,
      title,
      message,
      link,
      metadata
    });

    // Emit socket event if io is available
    // This will be handled in routes that have access to io

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Create notification and send email
const createNotificationWithEmail = async (companyId, userId, type, title, message, link, metadata = {}, forceEmail = false) => {
  const notification = await createNotification(companyId, userId, type, title, message, link, metadata);

  // Check if user wants email notifications
  const User = require('../models/User');
  const user = await User.findById(userId).select('email emailNotifications');
  
  const shouldSendEmail = forceEmail || (user && user.emailNotifications !== false);
  
  if (shouldSendEmail && user && user.email) {
    try {
      await sendEmail(
        user.email,
        title,
        `
          <h2>${title}</h2>
          <p>${message}</p>
          ${link ? `<p><a href="${process.env.FRONTEND_URL}${link}">View Details</a></p>` : ''}
        `
      );
    } catch (error) {
      console.error('Error sending notification email:', error);
    }
  }

  return notification;
};

// Notification templates
const notificationTemplates = {
  jobCreated: (job, user) => ({
    type: 'Job',
    title: 'New Job Created',
    message: `A new job "${job.title}" has been created`,
    link: `/jobs/${job._id}`,
    metadata: { jobId: job._id, createdBy: user.id }
  }),
  jobUpdated: (job, user) => ({
    type: 'Job',
    title: 'Job Updated',
    message: `Job "${job.title}" has been updated`,
    link: `/jobs/${job._id}`,
    metadata: { jobId: job._id, updatedBy: user.id }
  }),
  invoiceCreated: (invoice, user) => ({
    type: 'Invoice',
    title: 'New Invoice Created',
    message: `Invoice ${invoice.invoiceNumber} has been created`,
    link: `/invoices/${invoice._id}`,
    metadata: { invoiceId: invoice._id, createdBy: user.id }
  }),
  estimateAccepted: (estimate, user) => ({
    type: 'Estimate',
    title: 'Estimate Accepted',
    message: `Estimate ${estimate.estimateNumber} has been accepted`,
    link: `/estimates/${estimate._id}`,
    metadata: { estimateId: estimate._id }
  }),
  scheduleCreated: (schedule, user) => ({
    type: 'Schedule',
    title: 'New Schedule Created',
    message: `You have been scheduled for "${schedule.title}"`,
    link: `/schedules`,
    metadata: { scheduleId: schedule._id }
  }),
  userInvited: (email, role, companyName) => ({
    type: 'Team',
    title: 'Team Invitation',
    message: `You have been invited to join ${companyName} as ${role}`,
    link: '/invite',
    metadata: { email, role, companyName }
  })
};

module.exports = {
  createNotification,
  createNotificationWithEmail,
  notificationTemplates
};