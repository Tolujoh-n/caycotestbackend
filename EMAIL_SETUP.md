# Email Configuration for Production

## Environment Variables Required

Make sure to set these environment variables in your production deployment:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Cayco <noreply@cayco.com>
FRONTEND_URL=https://your-frontend-domain.com
```

## Gmail Setup (if using Gmail)

1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this app password (not your regular password) as `EMAIL_PASS`

## Other Email Providers

### For port 465 (SSL):
```
EMAIL_PORT=465
```
The system will automatically use `secure: true` for port 465.

### For port 587 (STARTTLS):
```
EMAIL_PORT=587
```
The system will automatically use `secure: false` with `requireTLS: true` for port 587.

## Common SMTP Settings

### Gmail
- Host: `smtp.gmail.com`
- Port: `587` (STARTTLS) or `465` (SSL)
- Requires App Password

### Outlook/Office365
- Host: `smtp.office365.com`
- Port: `587`
- Use your email and password

### SendGrid
- Host: `smtp.sendgrid.net`
- Port: `587`
- User: `apikey`
- Pass: Your SendGrid API key

### Mailgun
- Host: `smtp.mailgun.org`
- Port: `587`
- Use your Mailgun SMTP credentials

## Troubleshooting

If emails are not sending in production:

1. **Check environment variables** - Ensure all email-related env vars are set
2. **Check logs** - Look for email error messages in server logs
3. **Verify SMTP credentials** - Test with a simple email client first
4. **Check firewall** - Ensure your hosting provider allows outbound SMTP connections
5. **Port restrictions** - Some hosting providers block port 587, try 465 instead
6. **TLS/SSL issues** - The configuration automatically handles TLS based on port

## Testing

The email service will verify the connection on startup in production mode. Check your server logs for:
- "Email server is ready to send messages" (success)
- "Email server verification failed" (check credentials/network)
