# Resend email setup (email verification + payment emails)

LEENKIT sends two kinds of email through [Resend](https://resend.com):

| Email | Sent by | How |
|---|---|---|
| Signup confirmation, password reset | **Supabase Auth** | Supabase uses Resend as its custom SMTP server. Supabase still creates the links and decides who is verified. |
| Payment receipt; "payment not confirmed" or "Hangout cancelled" notice; refund issued | **Edge Functions** `paystack-webhook`, `verify-paystack-payment` and the scheduled `email-retry` sweeper | Resend HTTP API. The `payments` row is the outbox: each email kind is sent at most once per payment, and failed or interrupted sends are retried by the sweeper. Payments made before this feature never get emails (`emails_enabled = false`). |

Never put the Resend API key in the frontend, in `VITE_*` variables, or in Git. It belongs only in the Supabase dashboard (SMTP password) and in Edge Function secrets.

Do every step on **staging first** (see `docs/LAUNCH_READINESS.md`). Do not change production until staging passes the checks at the end.

## 1. Verify a sending domain in Resend

1. Resend → **Domains** → **Add domain**. Use a subdomain you control, e.g. `mail.yourdomain.com` (a subdomain keeps email reputation separate from your main domain).
2. Add the DNS records Resend shows (SPF `TXT`, DKIM `TXT`/`CNAME`, and the `MX` record for the bounce subdomain) at your DNS provider. Copy the values from Resend exactly.
3. Recommended: add a DMARC record for the root domain, e.g. `_dmarc.yourdomain.com TXT "v=DMARC1; p=none; rua=mailto:you@yourdomain.com"`.
4. Wait until Resend shows the domain as **Verified**.

`leenkit.netlify.app` is a Netlify domain and **cannot** be verified for sending. You need a domain you own.

## 2. Create API keys

Resend → **API Keys**:
- `leenkit-supabase-smtp`: permission **Sending access**, restricted to the verified domain.
- `leenkit-edge-functions`: permission **Sending access**, restricted to the verified domain.

Separate keys let you revoke one without breaking the other. Use separate keys for staging and production.

## 3. Supabase Auth → SMTP (signup confirmation, password reset)

Supabase dashboard → **Project Settings → Authentication → SMTP Settings** → enable **Custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `no-reply@mail.yourdomain.com` (on the verified domain) |
| Sender name | `LEENKIT` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `leenkit-supabase-smtp` API key |

Then **Authentication → Rate Limits**: with custom SMTP, raise "emails per hour" to a sensible value for launch (e.g. 100) and keep it bounded.

## 4. Supabase Auth → confirmation and redirects

1. **Authentication → Providers → Email**: turn on **Confirm email**.
2. **Authentication → URL Configuration**:
   - **Site URL**: the site for this project (production: `https://leenkit.netlify.app`; staging: the staging URL).
   - **Redirect URLs**: add
     - `https://<site>/auth/callback`
     - `https://<site>/reset-password`
     - for local development: `http://localhost:5173/auth/callback`, `http://localhost:5173/reset-password`
3. **Authentication → Email Templates → Confirm signup**: keep the `{{ .ConfirmationURL }}` link. Example body:

   ```html
   <h2>Confirm your LEENKIT account</h2>
   <p>Tap the button below to confirm your email address.</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
   <p>If you did not sign up for LEENKIT, you can ignore this email.</p>
   ```

The app sends signups to `/auth/callback?next=/onboarding`. That page waits for Supabase to sign the user in, then continues to onboarding. Expired or reused links show a "request a new link" form. If the callback URL is missing from Redirect URLs, Supabase falls back to the Site URL and the user is still signed in. They just land on the home page instead of onboarding.

Existing users are not affected by turning on **Confirm email**: it applies to new signups.

## 5. Edge Function secrets

Run in your own terminal (never paste keys into chats, tickets or files):

```bash
npx supabase secrets set --project-ref <ref> RESEND_API_KEY=<leenkit-edge-functions key>
npx supabase secrets set --project-ref <ref> EMAIL_FROM="LEENKIT <no-reply@mail.yourdomain.com>"
npx supabase secrets set --project-ref <ref> APP_URL=https://<site> SUPPORT_EMAIL=qleenqapp@gmail.com
npx supabase secrets set --project-ref <ref> ALLOWED_ORIGINS=https://<site>
npx supabase secrets set --project-ref <ref> EMAIL_RETRY_SECRET=<random, at least 24 characters>
# optional: EMAIL_REPLY_TO=qleenqapp@gmail.com
```

- `ALLOWED_ORIGINS` is **required**. Without it the Edge Functions reject every browser origin and payment callback URL (they fail closed). Use a comma-separated list; add `http://localhost:5173` only on a project used for local development, never on production.
- Generate `EMAIL_RETRY_SECRET` locally, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- If `RESEND_API_KEY` or `EMAIL_FROM` is missing, payments still settle normally and no email is sent (the functions log `email_not_configured`).

## 6. Deploy order (staging, then production)

1. Apply all migrations on this branch, in order (they are forward-only):
   `20261002000000`, `20261002010000`, `20261002020000`, `20261002020100`, `20261002020200`, `20261002030000`.
2. Set the secrets (step 5).
3. Deploy the Edge Functions:
   ```bash
   npx supabase functions deploy verify-paystack-payment initialize-paystack-transaction payout-account delete-account --project-ref <ref>
   # Called by Paystack / Supabase Cron, not by signed-in users; they authenticate
   # with their own secret (Paystack signature / x-cron-secret):
   npx supabase functions deploy paystack-webhook email-retry --no-verify-jwt --project-ref <ref>
   ```
4. Schedule the email sweeper. Enable the `pg_cron` and `pg_net` extensions (Database → Extensions), store the secret in Vault, then schedule it (SQL editor):
   ```sql
   select vault.create_secret('<EMAIL_RETRY_SECRET>', 'email_retry_secret');

   select cron.schedule('leenkit-email-retry', '*/10 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/email-retry',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_retry_secret')
       ),
       body := '{}'::jsonb
     );
   $$);
   ```
5. Configure SMTP and Auth settings (steps 3–4).
6. Deploy the frontend.

`20261002020100` makes `select('*')` on `profiles` fail for app users, and `20261002010000` moves the legal version to `2026-10-02`. The frontend on this branch matches both; the **currently live frontend** (`49b73ee`) does not. Ship the migrations, functions and frontend together.

## 7. Checks before production

- [ ] Sign up with a new email → confirmation email arrives from your domain (check spam placement too).
- [ ] Click the link → lands on `/auth/callback` → onboarding → Terms/Privacy prompt.
- [ ] Click the same link again → "This link has expired" page → resend works.
- [ ] Sign in before confirming → "Please confirm your email" + working resend button.
- [ ] Password reset email arrives and `/reset-password` works.
- [ ] Paystack **test** payment for a ticket → one receipt email; resend the webhook from the Paystack dashboard → no second email.
- [ ] Ticket bought when full → one "About your payment" email, no receipt.
- [ ] Host cancels a paid Hangout → after the next sweep, buyers get one "… was cancelled" email.
- [ ] Admin marks a payment refunded (with a Paystack refund reference) → after the next sweep, one "Your refund" email.
- [ ] Temporarily set a wrong `RESEND_API_KEY` → the payment still succeeds and `payments.email_last_error` is set; restore the key → the sweeper sends exactly one email.
- [ ] Resend dashboard → **Emails** shows deliveries; no bounces or complaints.
