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

### Connection timeout (ETIMEDOUT)

If you see `Connection timeout` or `ETIMEDOUT` when sending mail:

1. **Firewall / antivirus** – Windows Defender or other antivirus often blocks outbound SMTP. Temporarily allow Node/your app through the firewall or add an exception for outbound port 587 (or 465).
2. **Port 587 blocked** – Many home ISPs block port 587. Try SSL on port 465:
   - In `.env` set `EMAIL_PORT=465` (no quotes).
   - Restart the backend. The app uses SSL automatically when port is 465.
3. **No quotes in .env** – Use `EMAIL_HOST=smtp.gmail.com` not `EMAIL_HOST='smtp.gmail.com'`. Quotes can break the hostname.
4. **Dev without real email** – To keep invites working when SMTP is blocked (e.g. on your PC), set in `.env`:
   - `EMAIL_DEV_SKIP_SEND=true`
   - The app will not connect to SMTP; it will log the invite/reset link to the console so you can copy it and open in the browser. Invites and registration still “succeed” in the UI.

### Other issues

1. **Check environment variables** – Ensure `EMAIL_USER` and `EMAIL_PASS` are set (and, for Gmail, use an [App Password](https://support.google.com/accounts/answer/185833)).
2. **Check logs** – Look for email error messages in server logs.
3. **Verify SMTP** – Test the same host/port/user/pass in another client (e.g. Thunderbird) from the same network.
4. **Port restrictions** – If 587 fails, try `EMAIL_PORT=465`.

## Testing

The email service verifies the connection on startup in production. Check server logs for:

- `Email server is ready to send messages` (success)
- `Email server verification failed` (check credentials/network)
