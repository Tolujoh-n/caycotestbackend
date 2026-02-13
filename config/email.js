const nodemailer = require('nodemailer');

// Determine if we should use secure connection (port 465) or STARTTLS (port 587)
const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
const useSecure = emailPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: emailPort,
  secure: useSecure, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // Allow self-signed certificates if EMAIL_TLS_REJECT_UNAUTHORIZED is not set to 'true'
    // Set EMAIL_TLS_REJECT_UNAUTHORIZED=true in production for strict certificate validation
    rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED === 'true',
  },
  // Additional options for better compatibility
  requireTLS: !useSecure, // Require TLS for non-secure ports
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // Debug mode for development
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development'
});

// Verify transporter configuration
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email server verification failed:', error);
    return false;
  }
};

// Verify on startup (only in production to avoid blocking)
if (process.env.NODE_ENV === 'production') {
  verifyTransporter().catch(err => {
    console.error('Email verification error:', err);
  });
}

const sendEmail = async (to, subject, html) => {
  try {
    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Email credentials not configured');
      return { 
        success: false, 
        error: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.' 
      };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || `Cayco <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      // Additional options for better deliverability
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    console.log('Email sent to:', to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    return { 
      success: false, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
  }
};

const sendInviteEmail = async (email, companyName, role, inviteToken, organizationId) => {
  // Ensure FRONTEND_URL has a default for local development
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Remove trailing slash if present
  const baseUrl = frontendUrl.replace(/\/$/, '');
  const inviteLink = `${baseUrl}/invite/${inviteToken}`;
  
  // Log for debugging (remove in production if needed)
  console.log('Invite link generated:', inviteLink);
  console.log('FRONTEND_URL from env:', process.env.FRONTEND_URL);
  
  const subject = `Invitation to join ${companyName} on Cayco`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #d97706; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .org-id-box { background: #fff3cd; border: 2px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 20px 0; }
        .org-id-text { font-family: monospace; font-size: 18px; font-weight: bold; color: #92400e; }
        .copy-btn { background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 10px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cayco Business Operating System</h1>
        </div>
        <div class="content">
          <h2>You've been invited!</h2>
          <p>You have been invited to join <strong>${companyName}</strong> as a <strong>${role}</strong>.</p>
          
          <div class="org-id-box">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e;">Your Organization ID:</p>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="org-id-text" id="orgId">${organizationId}</span>
              <button class="copy-btn" onclick="navigator.clipboard.writeText('${organizationId}').then(() => alert('Organization ID copied!'))">Copy</button>
            </div>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #78350f;">You'll need this Organization ID to log in to your account. Please save it!</p>
          </div>
          
          <p>Click the button below to accept the invitation and set up your account:</p>
          <a href="${inviteLink}" class="button" style="background-color: #d97706; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; padding: 12px 24px;">Accept Invitation</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #d97706;">${inviteLink}</p>
          <p>This invitation will expire in 7 days.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Cayco. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(email, subject, html);
};

const sendForgotOrgIdEmail = async (email, organizations) => {
  const subject = 'Your Cayco Organization IDs';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .org-item { background: white; border: 2px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 15px 0; }
        .org-id-text { font-family: monospace; font-size: 18px; font-weight: bold; color: #92400e; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cayco Business Operating System</h1>
        </div>
        <div class="content">
          <h2>Your Organization IDs</h2>
          <p>Here are all the organizations you belong to:</p>
          ${organizations.map(org => `
            <div class="org-item">
              <h3 style="margin: 0 0 10px 0; color: #92400e;">${org.name}</h3>
              <p style="margin: 5px 0;">Role: <strong>${org.role}</strong></p>
              <p style="margin: 10px 0 0 0;">Organization ID: <span class="org-id-text">${org.organizationId}</span></p>
            </div>
          `).join('')}
          <p style="margin-top: 20px;">Use these Organization IDs along with your email and password to log in.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Cayco. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(email, subject, html);
};

const sendPasswordResetEmail = async (email, companyName, resetToken, organizationId) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const baseUrl = frontendUrl.replace(/\/$/, '');
  const resetLink = `${baseUrl}/reset-password/${resetToken}`;
  
  const subject = 'Reset Your Cayco Password';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #d97706; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #f59e0b; padding: 10px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cayco Business Operating System</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password for <strong>${companyName}</strong>.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" class="button" style="background-color: #d97706; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; padding: 12px 24px;">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #d97706;">${resetLink}</p>
          <div class="warning">
            <p style="margin: 0;"><strong>Note:</strong> This link will expire in 10 minutes for security reasons.</p>
          </div>
          <p>If you didn't request this password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Cayco. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(email, subject, html);
};

module.exports = { sendEmail, sendInviteEmail, sendForgotOrgIdEmail, sendPasswordResetEmail };