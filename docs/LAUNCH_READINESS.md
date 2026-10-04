# LEENKIT launch readiness

Status of branch `feature/payouts-admin` (not merged, not deployed). Nothing in
this document has been applied to production.

## Current launch mode: free Hangouts only

The Paystack account is a **Starter Business**, which has no Transfers (so
hosts cannot be paid automatically) and a ₦8,000,000 collection limit.
Owner decision (2026-10-04): launch with **free Hangouts only** until LEENKIT
is registered with CAC and the Paystack account is upgraded to a
**Registered Business**.

- `platform_settings.payments.paid_hangouts_enabled = false` (migration
  `20261004020000`). The database refuses paid Hangouts, the payment and
  payout functions refuse requests, and the app hides paid tickets, online
  sponsorships and payouts. Pledges still work.
- Existing paid Hangouts (created while testing) show "Ticket sales paused".
- For this launch you do **not** need Paystack live keys, the `payment-jobs`
  schedule, or `CRON_SECRET`.

**Release for the free launch:** back up → `npx supabase db push` → set
`ALLOWED_ORIGINS` and `APP_URL` → deploy the Edge Functions (§4/§8) → merge to
`main`.

**Turning paid Hangouts on later:**
1. Register LEENKIT with CAC and open a corporate bank account.
2. Paystack → Compliance → change business type to **Registered business**;
   wait for approval; check that **Transfers** now appears.
3. Follow §2–§4 and §7 (keys, webhook, OTP off, job schedule).
4. `update public.platform_settings set value = jsonb_set(value, '{paid_hangouts_enabled}', 'true') where key = 'payments';`
5. Remove the "Availability" sentence in Terms §7 and the "coming soon" FAQ
   answers (wording changes only; no new Terms version needed).

## 0. Email status: deferred (no sending domain yet)

Resend needs a domain you own (`leenkit.netlify.app` cannot be verified), so
email is **not** part of the first payments launch:

- Payment emails stay off: with no `RESEND_API_KEY`, the Edge Functions skip
  them and payments are unaffected. `email-retry` does not need to be deployed
  or scheduled yet. Paystack's own customer receipts can cover receipts.
- Terms, FAQ and Privacy do not promise LEENKIT emails and do not list Resend.
  When you enable Resend, re-add Resend to Privacy §10 (providers) and the
  payment-email line to §8 (uses).
- Keep **Confirm email** OFF in Supabase Auth for now. Supabase's built-in
  email service only delivers to your project's team members and is heavily
  rate-limited, so confirmation and password-reset emails would not reach
  normal users. The app works either way.
- **Password reset** has the same limitation. Until you own a domain you can
  configure Supabase custom SMTP with a Gmail account (`smtp.gmail.com`,
  port 465, a Google app password), which needs no domain.
- Fastest route to full email: buy a domain (~$10/year), use it as the
  Netlify site's custom domain, and verify a subdomain in Resend
  (`docs/RESEND_EMAIL_SETUP.md`).

## 1. Decisions

### Made by the owner (implemented)

| Topic | Decision | Implementation |
|---|---|---|
| Platform fee | 10% per ticket/sponsorship, minimum ₦200; minimum payment ₦1,000; LEENKIT pays Paystack's processing fee | `platform_settings.platform_fee`; Terms §7 |
| Host cancels (or LEENKIT cancels) | Every paid ticket and online sponsorship refunded **in full** | `flag_refunds_on_cancel()` queues full refunds |
| Spot not confirmed (full/closed/already going) | Full refund | `settle_payment()` → `requires_refund` → queued |
| Attendee or sponsor leaves ≥ 24h before start | Refund of what they paid **minus LEENKIT's fee** | `leave_hangout()`; preview in the Leave dialog |
| Leaves < 24h before start / no-show | No refund | `leave_hangout()` |
| Host money | **Held** until after the Hangout, then paid by Paystack Transfer ~48h after the start, minus refunds | `host_payouts` ledger + `payment-jobs` |

Refunds are sent automatically by `payment-jobs` through the Paystack Refund
API and completed by `refund.processed` webhooks. Paystack can take up to 10
business days to return money to cards/banks.

### Still open

| # | Decision | Current default |
|---|---|---|
| A | Payout account name matching | Not compared with the host's name (Terms say so) |
| B | Retention periods (payment events, reports, audit log, anonymised accounts) | None set; new Paystack events are stored minimised |
| C | Abuse limits | Reports 10/h and 3 per target/day; messages 20/min; pledges 10/h |
| D | Time zone for "24 hours before start" | West Africa Time (`platform_settings.payments.timezone`); per-Hangout time zones not supported yet |
| E | Legal: governing law, legal entity, minimum age, organizer verification process, professional legal review | Documents stay neutral |

## 2. Paystack requirements for this payment model

LEENKIT now collects payments into its own Paystack balance (no split
payments) and pays hosts by **Transfer**. In the Paystack dashboard:

1. Business **activated for live payments** (compliance approved). Transfers
   from the API generally require a **registered business** (not a Starter
   business).
2. **Transfers enabled** for the account.
3. **Disable transfer OTP** (Settings → Preferences) so the API can send
   transfers without a one-time code. If OTP stays on, payouts stop at
   `needs_review` with that instruction.
4. Settlement: payments settle to LEENKIT's Paystack **balance**, and payouts
   are drawn from that balance. If your account settles everything to your
   bank automatically, ask Paystack how to keep funds in the balance for
   transfers (or top up the balance before payouts run).
5. **Webhook URL** (test and live): `https://<ref>.supabase.co/functions/v1/paystack-webhook`.
   It must receive `charge.success`, `refund.*` and `transfer.*` events.
6. Customer receipts on (Settings → Preferences) while LEENKIT email is off.

## 3. Turning payouts on

Payouts are **off** by default. The ledger is still filled, so hosts see what
they will receive. To switch on (after §2 is done), in the SQL editor:

```sql
update public.platform_settings
set value = jsonb_set(value, '{payouts_enabled}', 'true')
where key = 'payments';
```

Refunds are on by default. To pause them in an emergency, set
`refunds_enabled` to `false` the same way.

## 4. Scheduled job

`payment-jobs` submits queued refunds and sends due payouts. Deploy it without
JWT verification (it checks its own secret) and run it every 10 minutes:

```bash
npx supabase secrets set --project-ref <ref> CRON_SECRET=<random, at least 24 characters>
npx supabase functions deploy payment-jobs --no-verify-jwt --project-ref <ref>
```

Enable `pg_cron` and `pg_net` (Database → Extensions), then in the SQL editor:

```sql
select vault.create_secret('<CRON_SECRET>', 'cron_secret');

select cron.schedule('leenkit-payment-jobs', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/payment-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
```

## 5. Staging setup checklist

There is no staging project yet. Production (`xczzkxxpxqkqkpratiyp`) must not
be used for staging.

1. **Supabase**: create a new project (e.g. `leenkit-staging`). Keep its keys
   and password separate from production.
2. **Migrations**: link the CLI to the *staging* ref and push:
   ```bash
   npx supabase link --project-ref <staging-ref>
   npx supabase db push
   npx supabase migration list
   ```
3. **Auth**: Site URL and Redirect URLs (`<staging>/auth/callback`,
   `<staging>/reset-password`); Google OAuth client for staging; Confirm
   email OFF (see §0).
4. **Paystack (test mode)**: `PAYSTACK_SECRET_KEY` = test secret key; webhook
   URL = `https://<staging-ref>.supabase.co/functions/v1/paystack-webhook`.
5. **Secrets**: `ALLOWED_ORIGINS=<staging site>`, `APP_URL=<staging site>`,
   `CRON_SECRET`. Deploy all Edge Functions
   (`paystack-webhook` and `payment-jobs` with `--no-verify-jwt`) and schedule
   `payment-jobs` (§4). Turn payouts on in staging (§3).
6. **Netlify**: second site (or branch deploy) with `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` of the **staging** project only.
7. **Admin**: `update public.profiles set is_admin = true where id = '<your staging user id>';`
8. **Test data**: test users only; Paystack test cards and test bank accounts.

## 6. Staging acceptance tests

- [ ] Sign up / Google sign-in → Terms & Privacy acceptance recorded once.
- [ ] Host adds payout bank account (Paystack test account) → "To be paid" shows ₦0.
- [ ] Buy a ticket (test card) → spot confirmed; resend the webhook → no duplicate.
- [ ] Leave ≥ 24h before start → dialog shows refund minus fee → refund appears in Paystack (test) → payment `refunded`.
- [ ] Leave < 24h before start → dialog says no refund; nothing refunded.
- [ ] Two buyers for the last spot → one confirmed, the other fully refunded automatically.
- [ ] Online sponsorship, then host cancels → ticket and sponsorship fully refunded.
- [ ] Hangout in the past (set its date back in staging) → after the next job run a payout is created; with payouts on, a Paystack test transfer is sent and marked paid by `transfer.success`.
- [ ] Cancelling that Hangout after the payout is paid is refused.
- [ ] Admin: refunds and payouts tabs; retry a failed refund / payout; audit log entries.
- [ ] Account deletion with and without payments.
- [ ] Security headers present; no CSP errors in the browser console.

## 7. Paystack live-payment checklist (only with explicit owner approval)

- [ ] §2 complete on the live Paystack account.
- [ ] All staging tests in §6 passed with test keys.
- [ ] Live **secret** key only as `PAYSTACK_SECRET_KEY` in the production project's Edge Function secrets (never in Git or `VITE_*`). The frontend uses no Paystack key (checkout is a redirect).
- [ ] Live webhook URL set: `https://xczzkxxpxqkqkpratiyp.supabase.co/functions/v1/paystack-webhook`.
- [ ] `ALLOWED_ORIGINS=https://leenkit.netlify.app` (plus any custom domain) in production.
- [ ] Test-mode payments created in production while it used test keys are reviewed (they are not real money) before live payouts are enabled.
- [ ] `payment-jobs` scheduled; payouts switched on (§3).
- [ ] Owner makes a small real payment, leaves ≥ 24h before start, and confirms the refund arrives.
- [ ] Rollback plan (§8) understood.

## 8. Production release and rollback

**Before release:** take a backup (Database → Backups on a paid plan; otherwise
`npx supabase db dump --linked -f backup-schema.sql` and
`npx supabase db dump --linked --data-only -f backup-data.sql`, which need
Docker) and keep it outside the repo.

**Release order (one window):** apply migrations → set secrets → deploy Edge
Functions → schedule `payment-jobs` → merge to `main` (Netlify deploys the
frontend) → smoke test → only then switch payouts on.

**Rollback:**
- Frontend: Netlify → Deploys → publish the previous deploy (`49b73ee`).
- Edge Functions: redeploy from the previous commit.
- Payments: set `refunds_enabled` / `payouts_enabled` to `false` to stop money movement immediately without a redeploy.
- Database: migrations are forward-only. If the old frontend must run against the new schema:
  ```sql
  grant select on table public.profiles to anon, authenticated;  -- old frontend selects * on profiles
  -- and re-create record_legal_acceptance() accepting version '2026-10-01'
  ```
  Restore from backup only as a last resort.
