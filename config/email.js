const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Cayco <noreply@cayco.com>',
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
};

const sendInviteEmail = async (email, companyName, role, inviteToken) => {
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
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
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
          <p>Click the button below to accept the invitation and set up your account:</p>
          <a href="${inviteLink}" class="button" style="background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; padding: 12px 24px;">Accept Invitation</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${inviteLink}</p>
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

module.exports = { sendEmail, sendInviteEmail };