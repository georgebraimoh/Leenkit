# LEENKIT launch readiness

Status of branch `feature/payouts-admin` (not merged, not deployed). Nothing in
this document has been applied to production.

## 0. Email status: deferred (no sending domain yet)

Resend needs a domain you own (`leenkit.netlify.app` cannot be verified), so
email is **not** part of the first payments launch:

- Payment emails stay off: with no `RESEND_API_KEY`, the Edge Functions skip
  them and payments are unaffected. `email-retry` does not need to be deployed
  or scheduled yet.
- Terms, FAQ and Privacy no longer promise LEENKIT receipts or refund emails,
  and Privacy does not list Resend. When you enable Resend, re-add Resend to
  Privacy §10 (providers) and the payment-email line to §8 (uses).
- Keep **Confirm email** OFF in Supabase Auth for now. Supabase's built-in
  email service only delivers to your project's team members and is heavily
  rate-limited, so confirmation (and password-reset) emails would not reach
  normal users. The app works either way.
- **Password reset** has the same limitation. Options until you own a domain:
  (a) accept that reset emails do not work for users yet, or (b) configure
  Supabase custom SMTP with a Gmail account (e.g. `qleenqapp@gmail.com`,
  `smtp.gmail.com`, port 465, a Google *app password*), which needs no domain
  and sends from that Gmail address (Google sending limits apply).
- Fastest route to full email: buy a domain (~$10/year), point it at Netlify
  as the site's custom domain, and verify a subdomain in Resend
  (`docs/RESEND_EMAIL_SETUP.md`).

## 1. Owner decisions required

These are business or legal choices. The code has defaults where noted; the
Terms/UI describe the defaults and must be updated if you choose differently.

| # | Decision | Current default in code | Where to change |
|---|---|---|---|
| 1 | **Platform fee** | 10% per ticket/sponsorship, minimum ₦200; minimum payment ₦1,000; LEENKIT pays Paystack's processing fee (`bearer: account`) | `public.platform_settings` (`platform_fee`), Terms §7, Sponsor modal copy |
| 2 | **Refund policy**: when refunds happen (host cancellation, platform cancellation, attendee leaving, overflow, duplicates), who approves, who funds them | Payments are *flagged* `requires_refund`; an admin issues the refund manually in Paystack and records the Paystack refund reference; buyer then gets a "refund issued" email. No automatic refunds, no deadline promised. | Terms §7, FAQ, admin process |
| 3 | **Who funds refunds under split payments.** The host's share is settled to their Paystack subaccount; a later refund may come out of LEENKIT's balance. | Not decided; nothing recovers money from hosts | Confirm with Paystack; decide policy |
| 4 | **Payout hold / dispute window.** Hosts are paid by Paystack on its settlement schedule; LEENKIT holds no balance, there is no in-app withdrawal and no ledger of host funds. | No hold | If you need a hold (e.g. until after the Hangout), configure Paystack subaccount settlement or switch to a transfer-based model (new work) |
| 5 | **Sponsorships on cancelled Hangouts** | Sponsorships *paid after* cancellation are flagged `requires_refund`; sponsorships paid *before* a cancellation are not flagged automatically | `flag_refunds_on_cancel()` |
| 6 | **Payout account name matching** | Account number is resolved with Paystack and the bank's account name is shown; it is **not** compared with the host's name | `payout-account` function, Terms §7 |
| 7 | **Retention periods** for payment events, safety reports, admin audit log, anonymised deleted accounts | None set (kept indefinitely). New Paystack events are stored minimised. `minimize_historical_payment_events()` exists but is not run. | Privacy §11; run the function only if you decide to |
| 8 | **Abuse limits** | Reports 10/hour and 3 per target per day; messages 20/minute; pledges 10/hour | `20261002030000` triggers |
| 9 | **Legal**: governing law, legal entity, minimum age, organizer verification process, professional legal review | Not decided; documents say so neutrally | Terms, Privacy |

## 2. Staging setup checklist

There is no staging project yet. Production (`xczzkxxpxqkqkpratiyp`) must not be used for staging.

1. **Supabase**: create a new project (e.g. `leenkit-staging`) in the same region. Keep its URL, anon key, service-role key and database password separate from production.
2. **Migrations**: from this branch, link the CLI to the *staging* ref and push:
   ```bash
   npx supabase link --project-ref <staging-ref>
   npx supabase db push            # applies every migration in supabase/migrations
   npx supabase migration list     # local and remote must match
   ```
   The same migrations are replayed from scratch by `npm run test:db` on every CI run.
3. **Auth**: Site URL = staging site; Redirect URLs = `<staging>/auth/callback`, `<staging>/reset-password`; Google OAuth client with the staging callback (`https://<staging-ref>.supabase.co/auth/v1/callback`); turn on Confirm email.
4. **Resend**: staging API keys; SMTP and Edge Function secrets per `docs/RESEND_EMAIL_SETUP.md`.
5. **Paystack**: **test** secret key in the staging project's secrets (`PAYSTACK_SECRET_KEY`); in the Paystack dashboard (test mode) set the webhook URL to `https://<staging-ref>.supabase.co/functions/v1/paystack-webhook`.
6. **Edge Function secrets**: `ALLOWED_ORIGINS=<staging site>`, `APP_URL=<staging site>`, Resend secrets, `EMAIL_RETRY_SECRET`. Deploy functions per `docs/RESEND_EMAIL_SETUP.md` §6 and schedule `email-retry`.
7. **Netlify**: either a second site from the same repo (simplest isolation) or a branch deploy of a `staging` branch. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the **staging** project for that site/context only. Production env vars stay unchanged.
8. **Admin**: make your staging account admin (SQL editor on staging): `update public.profiles set is_admin = true where id = '<your staging user id>';`
9. **Test data**: create test users only (no copies of production users). Use Paystack test cards.
10. Run the checks in `docs/RESEND_EMAIL_SETUP.md` §7 and §3 below.

## 3. Staging acceptance tests (manual, on staging)

- [ ] Email signup → confirm → onboarding → Terms/Privacy acceptance recorded.
- [ ] Google sign-in → acceptance prompt → recorded once.
- [ ] Free Hangout: create (Hosting Guidelines prompt), join, message, leave, cancel.
- [ ] Paid ticket (test card): one receipt; spot confirmed; webhook resend from Paystack does not duplicate.
- [ ] Two buyers for the last spot at the same time: one confirmed, the other `requires_refund` + "About your payment" email.
- [ ] Host cancels paid Hangout → tickets `requires_refund` → cancellation emails.
- [ ] Admin: refund in Paystack test dashboard → "Mark refunded" with the refund reference → refund email; audit log entry.
- [ ] Sponsorship (online and pledge); sponsor message visible to host only.
- [ ] Payout account: resolve + save with a Paystack test bank account.
- [ ] Account deletion: user with no payments (fully deleted); user with payments (anonymised; past Hangout images kept).
- [ ] Reports: submit; 11th report in an hour is refused with a friendly message.
- [ ] Security headers present (`curl -I <staging>`), no CSP errors in the browser console.

## 4. Paystack live-payment checklist (do not start without explicit owner approval)

- [ ] Paystack business account activated for live payments; compliance/KYC complete (owner).
- [ ] Decisions 1–5 above made, and Terms/FAQ/UI updated to match.
- [ ] All staging tests in §3 passed with test keys.
- [ ] Confirmed with Paystack: split-payment refund behaviour, chargeback liability, subaccount settlement schedule.
- [ ] Live **secret** key set only as `PAYSTACK_SECRET_KEY` in the production project's Edge Function secrets (never in Git or `VITE_*`). The frontend does not use a Paystack public key (checkout is a redirect).
- [ ] Live webhook URL in Paystack (live mode): `https://xczzkxxpxqkqkpratiyp.supabase.co/functions/v1/paystack-webhook`; signature verification uses the live secret key.
- [ ] `ALLOWED_ORIGINS=https://leenkit.netlify.app` (and any custom domain) set in production.
- [ ] Production smoke test with a small real payment by the owner, then refund it via the admin flow.
- [ ] Rollback plan (§5) rehearsed on staging.

## 5. Production release and rollback

**Before release:** take a backup (Supabase dashboard → Database → Backups if on a paid plan; otherwise `npx supabase db dump --linked -f backup-schema.sql` and `npx supabase db dump --linked --data-only -f backup-data.sql`, which need Docker) and store it outside the repo.

**Release order (one maintenance window):** apply migrations → set secrets → deploy Edge Functions → schedule `email-retry` → Auth/SMTP settings → merge to `main` (Netlify deploys the frontend) → smoke test.

**Rollback:**
- Frontend: Netlify → Deploys → publish the previous deploy (`49b73ee`).
- Edge Functions: redeploy from the previous commit (`git checkout 49b73ee -- supabase/functions && npx supabase functions deploy ...`), then restore the working tree.
- Database: migrations are forward-only. If the old frontend must run against the new schema, re-open the two compatibility points:
  ```sql
  -- old frontend selects * on profiles
  grant select on table public.profiles to anon, authenticated;
  -- old frontend records acceptance for 2026-10-01
  -- (re-create record_legal_acceptance with c_terms_version/c_privacy_version = '2026-10-01')
  ```
  Restore from backup only as a last resort (it loses data written since the backup).
