// Tests for 20261002030000_abuse_audit_payments_hardening.sql and the
// email-outbox columns of 20261002020200_payment_email_tracking.sql.
// Run: node tests/db/hardening.test.mjs  (in-memory database, no network)
import { createTestDb } from './harness.mjs';

const { db, ok, as, asErr, tryOk, mkUser, finish } = await createTestDb('hardening');

const host = await mkUser('host@x.com', { name: 'Host' });
const member = await mkUser('member@x.com', { name: 'Member' });
const other = await mkUser('other@x.com', { name: 'Other' });
const admin = await mkUser('admin@x.com', { name: 'Admin' });
await db.exec(`UPDATE public.profiles SET is_admin = true WHERE id = '${admin}'`);
await as('authenticated', host, `SELECT public.accept_hosting_guidelines('1.0')`);
await db.exec(`INSERT INTO public.host_payout_accounts (user_id, bank_code, bank_name, account_name, account_last4, paystack_recipient_code)
               VALUES ('${host}', '058', 'GTB', 'HOST', '1234', 'RCP_test')`);

const reqCols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hangouts' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows.map((r) => r.column_name);
const base = { title: "'H'", category: "'Food'", date: "'2026-12-01'", time: "'18:00'", max_attendees: '50' };
const mkHangout = async (extra = {}) => {
  const c = [...new Set([...reqCols, 'max_attendees', ...Object.keys(extra)])];
  const v = c.map((k) => (k === 'host_id' ? `'${host}'` : extra[k] ?? base[k] ?? "'x'"));
  return (await as('authenticated', host, `INSERT INTO public.hangouts (${c.join(',')}) VALUES (${v.join(',')}) RETURNING id`)).rows[0].id;
};
const free = await mkHangout();
await as('authenticated', member, `INSERT INTO public.hangout_attendees (hangout_id, user_id) VALUES ('${free}', '${member}')`);

// ---------------------------------------------------------------- rate limits
const report = (uid, target) =>
  as('authenticated', uid, `INSERT INTO public.safety_reports (target_type, target_id, reason) VALUES ('user', '${target}', 'Scam or spam')`);
for (let i = 0; i < 3; i++) await report(member, host);
await asErr('4th report on same target within 24h is rate limited', 'authenticated', member,
  `INSERT INTO public.safety_reports (target_type, target_id, reason) VALUES ('user', '${host}', 'Other concern')`, /LEENKIT_RATE_LIMITED/);
let okReports = 3;
for (let i = 0; i < 7; i++) { await report(member, crypto.randomUUID()); okReports++; }
ok('10 reports per hour allowed', okReports === 10);
await asErr('11th report in an hour is rate limited', 'authenticated', member,
  `INSERT INTO public.safety_reports (target_type, target_id, reason) VALUES ('user', '${crypto.randomUUID()}', 'x')`, /LEENKIT_RATE_LIMITED/);
await tryOk('another reporter is unaffected', () => report(other, host));

let sent = 0;
for (let i = 0; i < 20; i++) {
  await as('authenticated', member, `INSERT INTO public.hangout_messages (hangout_id, user_id, text) VALUES ('${free}', '${member}', 'm${i}')`);
  sent++;
}
ok('20 messages per minute allowed', sent === 20);
await asErr('21st message in a minute is rate limited', 'authenticated', member,
  `INSERT INTO public.hangout_messages (hangout_id, user_id, text) VALUES ('${free}', '${member}', 'spam')`, /LEENKIT_RATE_LIMITED/);
const sysBefore = (await db.query(`SELECT count(*)::int c FROM public.hangout_messages WHERE type='system'`)).rows[0].c;
await as('authenticated', other, `INSERT INTO public.hangout_attendees (hangout_id, user_id) VALUES ('${free}', '${other}')`);
const sysAfter = (await db.query(`SELECT count(*)::int c FROM public.hangout_messages WHERE type='system'`)).rows[0].c;
ok('system notices are not rate limited', sysAfter === sysBefore + 1);

for (let i = 0; i < 10; i++) {
  await as('authenticated', member, `INSERT INTO public.hangout_sponsorships (hangout_id, sponsor_id, amount, currency, message) VALUES ('${free}', '${member}', 1000, 'NGN', 'p${i}')`);
}
await asErr('11th pledge in an hour is rate limited', 'authenticated', member,
  `INSERT INTO public.hangout_sponsorships (hangout_id, sponsor_id, amount, currency) VALUES ('${free}', '${member}', 1000, 'NGN')`, /LEENKIT_RATE_LIMITED/);

// ------------------------------------------------------------------- storage
await as('authenticated', member, `INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-images', '${member}/a.jpg', '${member}')`);
await as('authenticated', host, `INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('hangout-images', '${host}/c.jpg', '${host}')`);
ok('anon cannot list uploaded files', (await as('anon', '', `SELECT name FROM storage.objects`)).rows.length === 0);
ok("users cannot list other users' files",
  (await as('authenticated', other, `SELECT name FROM storage.objects`)).rows.length === 0);
ok('owner can list own files', (await as('authenticated', member, `SELECT name FROM storage.objects`)).rows.length === 1);
await asErr('cannot upload into another user folder', 'authenticated', other,
  `INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('profile-images', '${member}/evil.jpg', '${other}')`, /row-level security/);

// ----------------------------------------------------------------- audit log
await asErr('non-admin cannot read audit log table', 'authenticated', member, `SELECT * FROM public.admin_audit_log`, /permission denied/);
await asErr('non-admin cannot call admin_list_audit', 'authenticated', member, `SELECT * FROM public.admin_list_audit()`, /Admins only/);
await asErr('non-admin cannot suspend', 'authenticated', member, `SELECT public.admin_set_suspension('${other}', true, 'x')`, /Admins only/);
const rid = (await db.query(`SELECT id FROM public.safety_reports LIMIT 1`)).rows[0].id;
await as('authenticated', admin, `SELECT public.admin_update_report('${rid}', 'reviewing', 'looking')`);
await as('authenticated', admin, `SELECT public.admin_set_suspension('${other}', true, 'abuse')`);
const audit = (await as('authenticated', admin, `SELECT action, admin_id, target_id FROM public.admin_list_audit()`)).rows;
ok('admin actions are audited with actor', audit.some((a) => a.action === 'report_status' && a.admin_id === admin) && audit.some((a) => a.action === 'suspend' && a.target_id === other), JSON.stringify(audit.map((a) => a.action)));
await asErr('audit log cannot be edited by users', 'authenticated', admin, `DELETE FROM public.admin_audit_log`, /permission denied/);

// ---------------------------------------------------- payments + refunds
const paid = await mkHangout({ is_paid: 'true', price: '5000', currency: "'NGN'" });
const pay = (ref, user, type, amt) => db.exec(`INSERT INTO public.payments (user_id, hangout_id, host_id, payment_type, reference, amount, currency, status, platform_fee, host_amount)
  VALUES ('${user}', '${paid}', '${host}', '${type}', '${ref}', ${amt}, 'NGN', 'pending', 500, ${amt - 500})`);
const settle = async (ref, sub) => (await as('service_role', '', `SELECT public.settle_payment('${ref}', ${sub}, 'NGN') AS s`)).rows[0].s;

await pay('T1', member, 'ticket', 5000);
ok('ticket settles', (await settle('T1', 500000)) === 'successful');
ok('new payments have emails enabled by default', (await db.query(`SELECT emails_enabled FROM public.payments WHERE reference='T1'`)).rows[0].emails_enabled === true);
const emailCols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='payments' AND column_name LIKE '%email%'`)).rows.map((r) => r.column_name).sort();
ok('email outbox columns present', ['email_attempts', 'email_last_error', 'emails_enabled', 'receipt_email_id', 'receipt_email_sent_at', 'refund_email_id', 'refund_email_sent_at', 'refund_notice_email_id', 'refund_notice_email_sent_at'].every((c) => emailCols.includes(c)), emailCols.join(','));

await pay('S1', member, 'sponsorship', 2000);
await as('authenticated', host, `UPDATE public.hangouts SET status='cancelled' WHERE id='${paid}'`);
ok('sponsorship paid after cancellation -> requires_refund (not recorded as paid)', (await settle('S1', 200000)) === 'requires_refund');
ok('no paid sponsorship row created for closed Hangout',
  (await db.query(`SELECT count(*)::int c FROM public.hangout_sponsorships WHERE status='paid' AND hangout_id=$1`, [paid])).rows[0].c === 0);

const t1 = (await db.query(`SELECT id, status FROM public.payments WHERE reference='T1'`)).rows[0];
ok('cancellation flags the ticket for refund', t1.status === 'requires_refund');
await asErr('cannot mark refunded without a Paystack refund reference', 'authenticated', admin, `SELECT public.admin_mark_refunded('${t1.id}', NULL)`, /refund reference/);
await asErr('blank refund reference rejected', 'authenticated', admin, `SELECT public.admin_mark_refunded('${t1.id}', '   ')`, /refund reference/);
await asErr('non-admin cannot mark refunded', 'authenticated', member, `SELECT public.admin_mark_refunded('${t1.id}', 'RF_1')`, /Admins only/);
await as('authenticated', admin, `SELECT public.admin_mark_refunded('${t1.id}', 'RF_12345')`);
const t1b = (await db.query(`SELECT status, refunded_at, metadata->>'refund_reference' AS rr FROM public.payments WHERE id=$1`, [t1.id])).rows[0];
ok('refund recorded with reference', t1b.status === 'refunded' && !!t1b.refunded_at && t1b.rr === 'RF_12345');
ok('refund audited', (await as('authenticated', admin, `SELECT * FROM public.admin_list_audit()`)).rows.some((a) => a.action === 'mark_refunded'));
// RLS has no UPDATE policy for payments: the update matches no rows.
await as('authenticated', member, `UPDATE public.payments SET status='successful' WHERE reference='T1'`).catch(() => {});
ok('payer cannot change payment status',
  (await db.query(`SELECT status FROM public.payments WHERE reference='T1'`)).rows[0].status === 'refunded');

// ----------------------------------------- payment-event minimisation
const fullPayload = {
  event: 'charge.success',
  data: {
    id: 123, reference: 'T1', amount: 500000, currency: 'NGN', status: 'success', paid_at: '2026-10-04T10:00:00Z',
    channel: 'card', gateway_response: 'Approved', fees: 7500, ip_address: '1.2.3.4',
    customer: { email: 'buyer@example.com', first_name: 'B', phone: '+234' },
    authorization: { bin: '408408', last4: '4081', card_type: 'visa', bank: 'TEST BANK', authorization_code: 'AUTH_x' },
    metadata: { user_id: member, hangout_id: paid, payment_type: 'ticket', referrer: 'https://x' },
    subaccount: { subaccount_code: 'ACCT_test', account_number: '0123456789' },
    log: { history: [] },
  },
};
await as('service_role', '', `INSERT INTO public.payment_events (event_key, event_type, reference, payload) VALUES ('k1', 'charge.success', 'T1', $1)`, [fullPayload]);
const stored = (await db.query(`SELECT payload FROM public.payment_events WHERE event_key='k1'`)).rows[0].payload;
const s = JSON.stringify(stored);
ok('stored event keeps reconciliation fields', stored.data.reference === 'T1' && stored.data.amount === 500000 && stored.data.fees === 7500 && stored.data.subaccount_code === 'ACCT_test');
ok('stored event drops email, card, IP, account number',
  !s.includes('buyer@example.com') && !s.includes('4081') && !s.includes('408408') && !s.includes('1.2.3.4') && !s.includes('AUTH_x') && !s.includes('0123456789'), s);

await db.exec(`ALTER TABLE public.payment_events DISABLE TRIGGER payment_events_minimize`);
await db.query(`INSERT INTO public.payment_events (event_key, event_type, reference, payload) VALUES ('k_old', 'charge.success', 'T1', $1)`, [fullPayload]);
await db.exec(`ALTER TABLE public.payment_events ENABLE TRIGGER payment_events_minimize`);
await asErr('only service role can minimise history', 'authenticated', admin, `SELECT public.minimize_historical_payment_events()`, /permission denied/);
const n = (await as('service_role', '', `SELECT public.minimize_historical_payment_events() AS n`)).rows[0].n;
const old = JSON.stringify((await db.query(`SELECT payload FROM public.payment_events WHERE event_key='k_old'`)).rows[0].payload);
ok('historical minimisation (on request) removes personal data', n === 1 && !old.includes('buyer@example.com'), `rows=${n}`);
// RLS has no SELECT policy for payment_events: users see no rows at all.
const visible = await as('authenticated', member, `SELECT * FROM public.payment_events`).then((r) => r.rows.length).catch(() => 0);
ok('payment events not readable by users', visible === 0, `visible=${visible}`);

finish();
