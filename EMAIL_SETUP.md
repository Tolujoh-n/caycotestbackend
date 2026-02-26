# Email Configuration (Resend)

The platform sends email (invites, password reset, registration, notifications) via [Resend](https://resend.com) using an API key.

## Environment Variables

Set these in `.env` (or your deployment environment):

```
RESEND_API_KEY=re_xxxxxxxxxxxx
FRONTEND_URL=https://your-frontend-domain.com
```

### Optional

- **RESEND_FROM** – Sender address. Format: `Cayco <noreply@yourdomain.com>`.  
  If not set, defaults to `Cayco <onboarding@resend.dev>` (Resend’s test sender; only for development).
- **EMAIL_FROM** – Same as `RESEND_FROM`; used as the “from” address if `RESEND_FROM` is not set.
- **EMAIL_DEV_SKIP_SEND** – Set to `true` to skip sending; invite/reset links are logged to the console so you can open them in the browser. Useful when developing locally.

## Setup Steps

1. **Create a Resend account**  
   Sign up at [resend.com](https://resend.com).

2. **Create an API key**  
   - Go to [Resend → API Keys](https://resend.com/api-keys)  
   - Create a key and copy it  
   - Add it to `.env` as `RESEND_API_KEY=re_...`

3. **Sender address**  
   - **Development:** You can leave `RESEND_FROM` unset. Resend will use `onboarding@resend.dev` (their test domain).  
   - **Production:**  
     - In [Resend → Domains](https://resend.com/domains), add and verify your domain.  
     - Set `RESEND_FROM=Cayco <noreply@yourdomain.com>` (or another address on that domain).

## Emails Sent by the Platform

- **Invite** – When a user is invited to join a company (link + Organization ID).
- **Forgot Organization ID** – Sends the user’s organization IDs to their email.
- **Password reset** – Link to reset password (scoped by organization).
- **Registration** – Sent when onboarding is completed (welcome + Organization ID).
- **Notifications** – In-app notifications can trigger emails (e.g. job created, invoice created) when the user has email notifications enabled.

All of these use the same Resend integration; no frontend changes are required.

## Troubleshooting

1. **“Email service not configured”**  
   Ensure `RESEND_API_KEY` is set in `.env` and the server was restarted after adding it.

2. **Resend returns an error**  
   Check server logs for the Resend error message. Common causes:
   - Invalid or revoked API key.
   - Sender domain not verified (use `onboarding@resend.dev` for testing).
   - Rate limits (see [Resend dashboard](https://resend.com/emails)).

3. **Skip sending in development**  
   Set `EMAIL_DEV_SKIP_SEND=true`. Invite and reset links will be printed in the console so you can open them without sending real email.

4. **Links point to wrong URL**  
   Set `FRONTEND_URL` to your frontend base URL (e.g. `https://app.cayco.com` or `http://localhost:3000`). No trailing slash.
