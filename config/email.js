const { Resend } = require('resend');

// Trim env values (in case .env has quotes)
const env = (key, def) => {
  const v = process.env[key];
  if (v == null || v === '') return def;
  const trimmed = typeof v === 'string' ? v.trim().replace(/^['"]|['"]$/g, '') : v;
  return trimmed || def;
};

const apiKey = env('RESEND_API_KEY', '');
const defaultFrom = env('RESEND_FROM', 'Cayco <onboarding@resend.dev>');
const resend = apiKey ? new Resend(apiKey) : null;

// When true, skip actual send and log content (for dev when you don't want to send real emails)
const skipSend = process.env.EMAIL_DEV_SKIP_SEND === 'true' || process.env.EMAIL_DEV_SKIP_SEND === '1';

/**
 * Send an email via Resend API.
 * @param {string} to - Recipient email
 * @param {string} subject - Subject line
 * @param {string} html - HTML body
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendEmail = async (to, subject, html) => {
  try {
    if (!apiKey || !resend) {
      console.error('Resend API key not configured');
      return {
        success: false,
        error: 'Email service not configured. Please set RESEND_API_KEY in your environment.'
      };
    }

    const from = env('EMAIL_FROM', '') || defaultFrom;

    if (skipSend) {
      console.log('[EMAIL_DEV_SKIP_SEND] Skipping send. Would have sent:');
      console.log('  To:', to, '| Subject:', subject);
      const linkMatch = html.match(/href="([^"]+)"/);
      if (linkMatch) console.log('  Link:', linkMatch[1]);
      return { success: true, messageId: 'dev-skip' };
    }

    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html
    });

    if (error) {
      console.error('Resend email error:', error);
      const errMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      return { success: false, error: errMsg };
    }

    console.log('Email sent successfully:', data?.id);
    console.log('Email sent to:', to);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Email sending error:', err);
    return {
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err : undefined
    };
  }
};

const sendInviteEmail = async (email, companyName, role, inviteToken, organizationId) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const baseUrl = frontendUrl.replace(/\/$/, '');
  const inviteLink = `${baseUrl}/invite/${inviteToken}`;

  console.log('Invite link generated:', inviteLink);

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

const sendRegistrationEmail = async (email, firstName, lastName, companyName, organizationId) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const baseUrl = frontendUrl.replace(/\/$/, '');
  const loginUrl = `${baseUrl}/login`;
  const settingsUrl = `${baseUrl}/settings`;

  const subject = 'Welcome to Cayco - Your Account Has Been Created Successfully';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #d97706; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .org-id-box { background: #fff3cd; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
        .org-id-text { font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: #92400e; letter-spacing: 2px; }
        .info-box { background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .highlight { color: #d97706; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">Cayco Business Operating System</h1>
        </div>
        <div class="content">
          <h2 style="color: #333; margin-top: 0;">Welcome, ${firstName}!</h2>
          <p>Congratulations! Your account has been successfully created for <strong>${companyName}</strong>.</p>
          <p>We're excited to have you on board and look forward to helping you streamline your business operations.</p>
          
          <div class="org-id-box">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #92400e; font-size: 16px;">Your Organization ID</p>
            <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <span class="org-id-text">${organizationId}</span>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 14px; color: #78350f; font-weight: 600;">
              ⚠️ Please save this Organization ID - you'll need it every time you log in!
            </p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #0066cc;">📋 Important Login Information</p>
            <p style="margin: 5px 0; color: #333;">
              To access your account, you will need to provide:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #333;">
              <li>Your <span class="highlight">Organization ID</span>: <strong>${organizationId}</strong></li>
              <li>Your email address: <strong>${email}</strong></li>
              <li>Your password (the one you created during registration)</li>
            </ul>
          </div>
          
          <div class="info-box" style="background: #f0f9ff; border-left-color: #0ea5e9;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #0c4a6e;">💡 Where to Find Your Organization ID</p>
            <p style="margin: 5px 0; color: #333;">
              Don't worry if you forget your Organization ID! You can always view it in your <strong>Profile Settings</strong> on the platform.
            </p>
            <p style="margin: 10px 0 5px 0; color: #333;">
              To access it:
            </p>
            <ol style="margin: 5px 0; padding-left: 20px; color: #333;">
              <li>Log in to your Cayco account</li>
              <li>Click on your profile icon in the top right corner</li>
              <li>Select <strong>"Settings"</strong> from the dropdown menu</li>
              <li>Navigate to the <strong>"Profile"</strong> section</li>
              <li>Your Organization ID will be displayed there</li>
            </ol>
          </div>
          
          <p style="margin-top: 30px;">Ready to get started? Click the button below to log in to your account:</p>
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button" style="background-color: #d97706; color: white; text-decoration: none; border-radius: 5px; padding: 14px 28px; font-weight: bold;">Log In to Your Account</a>
          </div>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
            If you have any questions or need assistance, please don't hesitate to reach out to our support team. We're here to help!
          </p>
        </div>
        <div class="footer">
          <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Cayco. All rights reserved.</p>
          <p style="margin: 5px 0; font-size: 11px; color: #999;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(email, subject, html);
};

module.exports = { sendEmail, sendInviteEmail, sendForgotOrgIdEmail, sendPasswordResetEmail, sendRegistrationEmail };
