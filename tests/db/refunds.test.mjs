// Tests for 20261004000000_refunds_and_held_payouts.sql: owner-approved
// refund policy (full refund on cancellation / unconfirmed spot; refund minus
// platform fee when leaving >= 24h before start; none later) and the held
// host-payout ledger.
// Run: node tests/db/refunds.test.mjs  (in-memory database, no network)
import { createTestDb } from './harness.mjs';

const { db, ok, as, asErr, tryOk, mkUser, finish } = await createTestDb('refunds');

const host = await mkUser('host@x.com', { name: 'Host' });
const noRecipientHost = await mkUser('host2@x.com', { name: 'Host Two' });
const early = await mkUser('early@x.com', { name: 'Early Leaver' });
const late = await mkUser('late@x.com', { name: 'Late Leaver' });
const stayer = await mkUser('stay@x.com', { name: 'Stayer' });
const outsider = await mkUser('out@x.com', { name: 'Outsider' });
const admin = await mkUser('admin@x.com', { name: 'Admin' });
await db.exec(`UPDATE public.profiles SET is_admin = true WHERE id = '${admin}'`);
for (const h of [host, noRecipientHost]) await as('authenticated', h, `SELECT public.accept_hosting_guidelines('1.0')`);
await db.exec(`INSERT INTO public.host_payout_accounts (user_id, bank_code, bank_name, account_name, account_last4, paystack_recipient_code)
               VALUES ('${host}', '058', 'GTB', 'HOST', '1234', 'RCP_host')`);
await db.exec(`INSERT INTO public.host_payout_accounts (user_id, bank_code, bank_name, account_name, account_last4, paystack_subaccount_code)
               VALUES ('${noRecipientHost}', '058', 'GTB', 'HOST2', '9999', 'ACCT_legacy')`);

const reqCols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hangouts' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows.map((r) => r.column_name);
const insertHangout = (who, extra = {}) => {
  const base = { title: "'H'", category: "'Food'", date: "(current_date + 30)", time: "'18:00'", max_attendees: '10', is_paid: 'true', price: '5000', currency: "'NGN'" };
  const c = [...new Set([...reqCols, ...Object.keys(base), ...Object.keys(extra)])];
  const v = c.map((k) => (k === 'host_id' ? `'${who}'` : extra[k] ?? base[k] ?? "'x'"));
  return `INSERT INTO public.hangouts (${c.join(',')}) VALUES (${v.join(',')}) RETURNING id`;
};
const mkPaidHangout = async () => (await as('authenticated', host, insertHangout(host))).rows[0].id;
// Move a Hangout's start to now + offset (Lagos time), bypassing client guards.
const setStart = (id, offset) => as('service_role', '', `
  UPDATE public.hangouts SET
    date = ((now() + interval '${offset}') AT TIME ZONE 'Africa/Lagos')::date,
    time = ((now() + interval '${offset}') AT TIME ZONE 'Africa/Lagos')::time
  WHERE id = '${id}'`);

let refN = 0;
const buy = async (hangout, user, type = 'ticket', amount = 5000, mode = 'live') => {
  const ref = `R${++refN}`;
  const fee = Math.max(Math.round(amount * 0.1), 200);
  await db.exec(`INSERT INTO public.payments (user_id, hangout_id, host_id, payment_type, reference, amount, currency, status, platform_fee, host_amount, paystack_mode)
                 VALUES ('${user}', '${hangout}', '${host}', '${type}', '${ref}', ${amount}, 'NGN', 'pending', ${fee}, ${amount - fee}, '${mode}')`);
  const s = (await as('service_role', '', `SELECT public.settle_payment('${ref}', ${amount * 100}, 'NGN') AS s`)).rows[0].s;
  return { ref, s, fee };
};
const pay = async (ref) => (await db.query(`SELECT * FROM public.payments WHERE reference=$1`, [ref])).rows[0];
const attending = async (h, u) => (await db.query(`SELECT count(*)::int c FROM public.hangout_attendees WHERE hangout_id=$1 AND user_id=$2`, [h, u])).rows[0].c === 1;

// ------------------------------------------------ master switch (default off)
const switchOff = (await db.query(`SELECT value FROM public.platform_settings WHERE key='payments'`)).rows[0].value;
ok('paid Hangouts are switched OFF by default', switchOff.paid_hangouts_enabled === false);
await asErr('paid Hangout rejected by the database while switched off', 'authenticated', host, insertHangout(host), /PAID_HANGOUTS_DISABLED/);
const freeId = (await as('authenticated', host, insertHangout(host, { is_paid: 'false', price: 'NULL' }))).rows[0].id;
ok('free Hangouts still work while paid is off', !!freeId);
await asErr('cannot turn a free Hangout paid while switched off', 'authenticated', host,
  `UPDATE public.hangouts SET is_paid = true, price = 5000 WHERE id = '${freeId}'`, /PAID_HANGOUTS_DISABLED/);
await db.exec(`UPDATE public.platform_settings SET value = value || '{"paid_hangouts_enabled": true}'::jsonb WHERE key = 'payments'`);

// ------------------------------------------------ setup checks
await asErr('paid Hangout needs a transfer-capable payout account', 'authenticated', noRecipientHost, insertHangout(noRecipientHost), /PAYOUT_SETUP_REQUIRED/);
const settings = (await db.query(`SELECT value FROM public.platform_settings WHERE key='payments'`)).rows[0].value;
ok('payouts are OFF by default, refunds ON, payout_mode live', settings.payout_mode === 'live' && settings.payouts_enabled === false && settings.refunds_enabled === true && settings.leave_cutoff_hours === 24);

// ------------------------------------------------ leaving >= 24h before start
const h1 = await mkPaidHangout();
const t1 = await buy(h1, early);
ok('ticket settles', t1.s === 'successful' && (await attending(h1, early)));
const sp1 = await buy(h1, early, 'sponsorship', 2000);
ok('sponsorship settles', sp1.s === 'successful');

const preview = (await as('authenticated', early, `SELECT public.get_leave_refund_preview('${h1}') AS p`)).rows[0].p;
ok('preview: eligible, refund = paid minus LEENKIT fee', preview.eligible === true && Number(preview.refund_amount) === (5000 - 500) + (2000 - 200), JSON.stringify(preview));

const left = (await as('authenticated', early, `SELECT public.leave_hangout('${h1}') AS r`)).rows[0].r;
ok('leave >=24h returns refund amount', Number(left.refund_amount) === 6300, JSON.stringify(left));
const p1 = await pay(t1.ref);
ok('ticket queued for refund minus fee', p1.status === 'requires_refund' && Number(p1.refund_amount) === 4500 && p1.refund_status === 'queued' && p1.refund_reason === 'attendee_left');
const ps1 = await pay(sp1.ref);
ok('sponsorship queued for refund minus fee', ps1.status === 'requires_refund' && Number(ps1.refund_amount) === 1800);
ok('sponsorship row marked requires_refund', (await db.query(`SELECT status FROM public.hangout_sponsorships WHERE payment_id=$1`, [ps1.id])).rows[0].status === 'requires_refund');
ok('leaver removed from attendees', !(await attending(h1, early)));

// ------------------------------------------------ leaving < 24h before start
const t2 = await buy(h1, late);
await setStart(h1, '2 hours');
const preview2 = (await as('authenticated', late, `SELECT public.get_leave_refund_preview('${h1}') AS p`)).rows[0].p;
ok('preview < 24h: not eligible', preview2.eligible === false && Number(preview2.refund_amount) === 0);
await as('authenticated', late, `SELECT public.leave_hangout('${h1}')`);
const p2 = await pay(t2.ref);
ok('leave < 24h: no refund, payment stays successful', p2.status === 'successful' && p2.refund_amount === null);
ok('late leaver still removed', !(await attending(h1, late)));

await asErr('host cannot leave own Hangout', 'authenticated', host, `SELECT public.leave_hangout('${h1}')`, /cannot leave/);
await asErr('anon cannot leave', 'anon', '', `SELECT public.leave_hangout('${h1}')`, /permission denied/);

// ------------------------------------------------ host cancellation: full refunds
const h2 = await mkPaidHangout();
const t3 = await buy(h2, stayer);
const sp3 = await buy(h2, stayer, 'sponsorship', 3000);
await as('authenticated', host, `UPDATE public.hangouts SET status='cancelled' WHERE id='${h2}'`);
const p3 = await pay(t3.ref);
const ps3 = await pay(sp3.ref);
ok('cancel: ticket refunded in FULL', p3.status === 'requires_refund' && Number(p3.refund_amount) === 5000 && p3.refund_reason === 'hangout_cancelled' && p3.refund_status === 'queued');
ok('cancel: sponsorship refunded in FULL', ps3.status === 'requires_refund' && Number(ps3.refund_amount) === 3000);
ok('cancel: sponsorship row requires_refund', (await db.query(`SELECT status FROM public.hangout_sponsorships WHERE payment_id=$1`, [ps3.id])).rows[0].status === 'requires_refund');

// ------------------------------------------------ unconfirmed spot: full refund
const h3 = (await as('authenticated', host, insertHangout(host, { max_attendees: '2' }))).rows[0].id;
await buy(h3, stayer);
const over = await buy(h3, outsider);
const po = await pay(over.ref);
ok('overflow: full refund queued automatically', over.s === 'requires_refund' && Number(po.refund_amount) === 5000 && po.refund_status === 'queued');

// ------------------------------------------------ completing refunds
await asErr('users cannot complete refunds', 'authenticated', early, `SELECT public.complete_payment_refund('${t1.ref}')`, /permission denied/);
const c1 = (await as('service_role', '', `SELECT public.complete_payment_refund('${t1.ref}', 4500) AS r`)).rows[0].r;
const p1b = await pay(t1.ref);
ok('refund.processed -> refunded', c1 === 'refunded' && p1b.status === 'refunded' && p1b.refund_status === 'processed' && !!p1b.refunded_at);
ok('completion is idempotent', (await as('service_role', '', `SELECT public.complete_payment_refund('${t1.ref}') AS r`)).rows[0].r === 'already_refunded');
const sp1done = (await as('service_role', '', `SELECT public.complete_payment_refund('${sp1.ref}') AS r`)).rows[0].r;
ok('sponsorship refund completes', sp1done === 'refunded' && (await db.query(`SELECT status FROM public.hangout_sponsorships WHERE payment_id=$1`, [ps1.id])).rows[0].status === 'refunded');
// A refund issued from the Paystack dashboard for a still-attending buyer:
const h4 = await mkPaidHangout();
const t4 = await buy(h4, stayer);
await as('service_role', '', `SELECT public.complete_payment_refund('${t4.ref}', 5000)`);
ok('dashboard refund removes the attendee', (await pay(t4.ref)).status === 'refunded' && !(await attending(h4, stayer)));

// ------------------------------------------------ held payouts
const h5 = await mkPaidHangout();
const a = await buy(h5, stayer);
const b = await buy(h5, late, 'ticket', 8000);
const c = await buy(h5, outsider, 'sponsorship', 2000);
ok('nothing scheduled before the Hangout', (await as('service_role', '', `SELECT public.schedule_host_payouts() AS n`)).rows[0].n === 0);
await setStart(h5, '-3 days');
const n1 = (await as('service_role', '', `SELECT public.schedule_host_payouts() AS n`)).rows[0].n;
const payouts = (await db.query(`SELECT * FROM public.host_payouts WHERE hangout_id=$1`, [h5])).rows;
const expected = (5000 - 500) + (8000 - 800) + (2000 - 200);
ok('payout scheduled 48h after start for host share', n1 >= 1 && payouts.length === 1 && Number(payouts[0].amount) === expected && payouts[0].status === 'scheduled' && payouts[0].recipient_code === 'RCP_host', JSON.stringify(payouts.map((p) => [p.amount, p.status])));
ok('payments linked to payout once', (await db.query(`SELECT count(*)::int c FROM public.payments WHERE payout_id=$1`, [payouts[0].id])).rows[0].c === 3);
ok('scheduling again creates nothing', (await as('service_role', '', `SELECT public.schedule_host_payouts() AS n`)).rows[0].n === 0);
ok('refunded / requires_refund payments are never paid out',
  (await db.query(`SELECT count(*)::int c FROM public.payments WHERE payout_id IS NOT NULL AND status <> 'successful'`)).rows[0].c === 0);
await asErr('users cannot schedule payouts', 'authenticated', host, `SELECT public.schedule_host_payouts()`, /permission denied/);

// RLS on the ledger
ok('host sees own payouts', (await as('authenticated', host, `SELECT id FROM public.host_payouts`)).rows.length >= 1);
ok('other users see none', (await as('authenticated', outsider, `SELECT id FROM public.host_payouts`)).rows.length === 0);
await asErr('anon cannot read payouts', 'anon', '', `SELECT id FROM public.host_payouts`, /permission denied/);
await asErr('host cannot edit payouts', 'authenticated', host, `UPDATE public.host_payouts SET amount = 999999`, /permission denied/);

// Earnings view
const earn = (await as('authenticated', host, `SELECT * FROM public.get_host_earnings()`)).rows[0];
ok('earnings split into to-be-paid and paid', Number(earn.to_be_paid) >= expected && Number(earn.paid_out) === 0, JSON.stringify(earn));
await db.exec(`UPDATE public.host_payouts SET status='paid', paid_at=now() WHERE id='${payouts[0].id}'`);
const earn2 = (await as('authenticated', host, `SELECT * FROM public.get_host_earnings()`)).rows[0];
ok('paid payouts show as paid out', Number(earn2.paid_out) === expected);

// No cancellation after money has been sent
await asErr('cannot cancel once the payout was paid', 'authenticated', host, `UPDATE public.hangouts SET status='cancelled' WHERE id='${h5}'`, /PAYOUT_ALREADY_SENT/);

// Cancelling while a payout is only scheduled undoes it and refunds everyone
const h6 = await mkPaidHangout();
const d = await buy(h6, stayer);
await setStart(h6, '-3 days');
await as('service_role', '', `SELECT public.schedule_host_payouts()`);
const p6 = (await db.query(`SELECT id, status FROM public.host_payouts WHERE hangout_id=$1`, [h6])).rows[0];
ok('payout scheduled for h6', p6?.status === 'scheduled');
await as('service_role', '', `UPDATE public.hangouts SET status='cancelled' WHERE id='${h6}'`);
ok('scheduled payout cancelled on cancellation', (await db.query(`SELECT status FROM public.host_payouts WHERE id=$1`, [p6.id])).rows[0].status === 'cancelled');
const pd = await pay(d.ref);
ok('its payment unlinked and fully refunded', pd.payout_id === null && pd.status === 'requires_refund' && Number(pd.refund_amount) === 5000);

// Host without a transfer recipient -> needs review, not sent
const legacyHangout = (await as('service_role', '', insertHangout(noRecipientHost))).rows[0].id;
await db.exec(`INSERT INTO public.payments (user_id, hangout_id, host_id, payment_type, reference, amount, currency, status, platform_fee, host_amount, paystack_mode)
               VALUES ('${stayer}', '${legacyHangout}', '${noRecipientHost}', 'ticket', 'LEG1', 5000, 'NGN', 'successful', 500, 4500, 'live')`);
await setStart(legacyHangout, '-3 days');
await as('service_role', '', `SELECT public.schedule_host_payouts()`);
ok('host without recipient -> payout needs_review', (await db.query(`SELECT status FROM public.host_payouts WHERE hangout_id=$1`, [legacyHangout])).rows[0].status === 'needs_review');

// ------------------------------------------------ test-mode payments are never paid out
const hTest = await mkPaidHangout();
await buy(hTest, stayer, 'ticket', 5000, 'test');
await db.exec(`INSERT INTO public.payments (user_id, hangout_id, host_id, payment_type, reference, amount, currency, status, platform_fee, host_amount)
               VALUES ('${outsider}', '${hTest}', '${host}', 'ticket', 'LEGACY_NULL_MODE', 5000, 'NGN', 'successful', 500, 4500)`);
await setStart(hTest, '-3 days');
await as('service_role', '', `SELECT public.schedule_host_payouts()`);
ok('test-mode and legacy (unknown mode) payments are never paid out with live payouts',
  (await db.query(`SELECT count(*)::int c FROM public.host_payouts WHERE hangout_id=$1`, [hTest])).rows[0].c === 0);
await db.exec(`UPDATE public.platform_settings SET value = value || '{"payout_mode":"test"}'::jsonb WHERE key='payments'`);
await as('service_role', '', `SELECT public.schedule_host_payouts()`);
const testPayout = (await db.query(`SELECT amount FROM public.host_payouts WHERE hangout_id=$1`, [hTest])).rows;
ok('staging (payout_mode=test) pays out only test payments', testPayout.length === 1 && Number(testPayout[0].amount) === 4500);
await db.exec(`UPDATE public.platform_settings SET value = value || '{"payout_mode":"live"}'::jsonb WHERE key='payments'`);
ok('payout_mode is live by default (fresh database)', settings.payout_mode === undefined || settings.payout_mode === 'live');

// ------------------------------------------------ admin tools
const failed = await buy(await mkPaidHangout(), outsider);
await as('service_role', '', `UPDATE public.payments SET status='requires_refund', refund_status='failed' WHERE reference='${failed.ref}'`);
const fp = await pay(failed.ref);
await asErr('non-admin cannot retry refunds', 'authenticated', outsider, `SELECT public.admin_retry_refund('${fp.id}')`, /Admins only/);
await tryOk('admin retries a failed refund', () => as('authenticated', admin, `SELECT public.admin_retry_refund('${fp.id}')`));
ok('retried refund is queued again', (await pay(failed.ref)).refund_status === 'queued');
const reviewPayout = (await db.query(`SELECT id FROM public.host_payouts WHERE hangout_id=$1`, [legacyHangout])).rows[0].id;
await asErr('retry payout needs a recipient', 'authenticated', admin, `SELECT public.admin_retry_payout('${reviewPayout}')`, /no payout account/);
ok('admin sees payouts', (await as('authenticated', admin, `SELECT * FROM public.admin_list_payouts()`)).rows.length >= 3);
await asErr('non-admin cannot list payouts', 'authenticated', host, `SELECT * FROM public.admin_list_payouts()`, /Admins only/);
const listed = (await as('authenticated', admin, `SELECT * FROM public.admin_list_payments('requires_refund')`)).rows;
ok('admin payment list shows refund amount/status', listed.some((r) => r.refund_status && r.refund_amount !== null));

finish();
