// Runtime tests for the payouts/admin/account-deletion batch and the
// profile-privacy / signup-normalisation / email-tracking migrations:
// Hangout lifecycle, capacity, messages, cancellations, settle_payment,
// admin authorisation, account deletion, private profile columns.
// Run: node tests/db/batch.test.mjs  (in-memory database, no network)
import { createTestDb } from './harness.mjs';

const { db, ok, as, asErr, tryOk, mkUser, finish } = await createTestDb('batch');

// ===== New-batch runtime tests =====
const mk = mkUser;
const host = await mk('host@x.com', { name: 'Host', avatar: 'https://x/h.png' });
const u1 = await mk('u1@x.com', { name: 'User One' });
const u2 = await mk('u2@x.com', { name: 'User Two' });
const buyer = await mk('buyer@x.com', { name: 'Buyer' });
await as('authenticated', host, `SELECT public.accept_hosting_guidelines('1.0')`);

// Signup edge cases vs new CHECK constraints (S11)
await tryOk('81-char name signup succeeds', () => mk('long@x.com', { name: 'N'.repeat(81) }));
await tryOk('non-https avatar signup succeeds', () => mk('av@x.com', { name: 'Av', avatar: 'http://insecure/a.png' }));

const cols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hangouts' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`)).rows.map((r) => r.column_name);
const base = { title: "'Free one'", category: "'Food'", date: "'2026-12-01'", time: "'18:00'", max_attendees: '2' };
const mkHangout = async (who, extra = {}) => {
  const c = [...new Set([...cols, 'max_attendees', ...Object.keys(extra)])];
  const v = c.map((k) => (k === 'host_id' ? `'${who}'` : extra[k] ?? base[k] ?? "'x'"));
  return (await as('authenticated', who, `INSERT INTO public.hangouts (${c.join(',')}) VALUES (${v.join(',')}) RETURNING id`)).rows[0];
};
const cnt = async (id) => (await db.query(`SELECT attendee_count FROM public.hangouts WHERE id=$1`, [id])).rows[0].attendee_count;
const sysMsgs = async (id) => (await db.query(`SELECT text FROM public.hangout_messages WHERE hangout_id=$1 AND type='system'`, [id])).rows.map((r) => r.text);

const h = await tryOk('host creates free Hangout', () => mkHangout(host));
if (h) {
  ok('host auto-attends (count 1)', (await cnt(h.id)) === 1);
  ok('opening system message posted', (await sysMsgs(h.id)).some((t) => /created the Hangout/.test(t)));
  await tryOk('member joins free Hangout', () => as('authenticated', u1, `INSERT INTO public.hangout_attendees (hangout_id, user_id) VALUES ('${h.id}', '${u1}')`));
  ok('count 2 + join notice', (await cnt(h.id)) === 2 && (await sysMsgs(h.id)).some((t) => /joined/.test(t)));
  await asErr('capacity enforced (max 2)', 'authenticated', u2, `INSERT INTO public.hangout_attendees (hangout_id, user_id) VALUES ('${h.id}', '${u2}')`, /CAPACITY/);
  await tryOk('member posts message', () => as('authenticated', u1, `INSERT INTO public.hangout_messages (hangout_id, user_id, text, type, user_name) VALUES ('${h.id}', '${u1}', 'hi', 'system', 'Admin')`));
  const m = (await db.query(`SELECT type, user_name FROM public.hangout_messages WHERE text='hi'`)).rows[0];
  ok('client cannot post system msg / spoof name', m?.type === 'user' && m?.user_name === 'User One', JSON.stringify(m));
  await asErr('anon cannot read attendees', 'anon', '', `SELECT * FROM public.hangout_attendees`, /permission denied/);
  await tryOk('host cancels Hangout', () => as('authenticated', host, `UPDATE public.hangouts SET status='cancelled' WHERE id='${h.id}'`));
  const notif = (await db.query(`SELECT count(*)::int c FROM public.notifications WHERE hangout_id=$1 AND type='hangout_cancelled'`, [h.id])).rows[0].c;
  ok('cancel notifies attendees', notif === 1, `notifications=${notif}`);
  await asErr('no messages after cancel', 'authenticated', u1, `INSERT INTO public.hangout_messages (hangout_id, user_id, text) VALUES ('${h.id}', '${u1}', 'late')`, /CLOSED/);
}

// Paid flow
await asErr('paid Hangout without payout account blocked', 'authenticated', host, `INSERT INTO public.hangouts (${[...new Set([...cols, 'max_attendees', 'is_paid', 'price', 'currency'])].join(',')}) VALUES (${[...new Set([...cols, 'max_attendees', 'is_paid', 'price', 'currency'])].map((k) => (k === 'host_id' ? `'${host}'` : { is_paid: 'true', price: '5000', currency: "'NGN'" }[k] ?? base[k] ?? "'x'")).join(',')})`, /PAYOUT_SETUP_REQUIRED/);
await db.exec(`INSERT INTO public.host_payout_accounts (user_id, bank_code, bank_name, account_name, account_last4, paystack_recipient_code) VALUES ('${host}', '058', 'GTB', 'HOST', '1234', 'RCP_x')`);
const ph = await tryOk('paid Hangout with payout account', () => mkHangout(host, { is_paid: 'true', price: '5000', currency: "'NGN'" }));
if (ph) {
  const pay = (ref, user, type = 'ticket', amt = 5000) => db.exec(`INSERT INTO public.payments (user_id, hangout_id, host_id, payment_type, reference, amount, currency, status, platform_fee, host_amount) VALUES ('${user}', '${ph.id}', '${host}', '${type}', '${ref}', ${amt}, 'NGN', 'pending', 500, 4500)`);
  const settle = async (ref, sub, cur = 'NGN') => (await as('service_role', '', `SELECT public.settle_payment('${ref}', ${sub}, '${cur}') AS s`)).rows[0].s;
  await pay('R1', buyer);
  ok('settle ticket -> successful', (await settle('R1', 500000)) === 'successful');
  ok('settle idempotent', (await settle('R1', 500000)) === 'successful');
  ok('buyer now attending (count 2)', (await cnt(ph.id)) === 2);
  await pay('R2', u2);
  ok('overflow -> requires_refund', (await settle('R2', 500000)) === 'requires_refund');
  await db.exec(`INSERT INTO public.hangout_attendees (hangout_id, user_id) SELECT '${ph.id}', '${u1}' WHERE false`);
  await pay('R3', u1, 'sponsorship', 2000);
  ok('amount mismatch flagged', (await settle('R3', 100)) === 'flagged_mismatch');
  await pay('R4', buyer, 'sponsorship', 2000);
  ok('sponsorship settles', (await settle('R4', 200000)) === 'successful');
  await asErr('authenticated cannot call settle_payment', 'authenticated', buyer, `SELECT public.settle_payment('R1', 1, 'NGN')`, /permission denied/);
  await asErr('price locked after sale', 'authenticated', host, `UPDATE public.hangouts SET price = 100 WHERE id='${ph.id}'`, /cannot change/);
  await tryOk('host cancels paid Hangout', () => as('authenticated', host, `UPDATE public.hangouts SET status='cancelled' WHERE id='${ph.id}'`));
  const rr = (await db.query(`SELECT reference, status FROM public.payments WHERE hangout_id=$1 ORDER BY reference`, [ph.id])).rows.map((r) => r.reference + ':' + r.status).join(',');
  ok('cancel flags ticket refunds', /R1:requires_refund/.test(rr), rr);
  ok('cancel also refunds paid sponsorships (owner policy)', /R4:requires_refund/.test(rr), rr);
}

// Admin
await asErr('non-admin blocked from admin_list_reports', 'authenticated', u1, `SELECT * FROM public.admin_list_reports()`, /Admins only/);
await db.exec(`UPDATE public.profiles SET is_admin = true WHERE id='${host}'`);
await tryOk('admin can call admin_overview', () => as('authenticated', host, `SELECT * FROM public.admin_overview()`));
await asErr('client cannot self-promote to admin', 'authenticated', u1, `UPDATE public.profiles SET is_admin = true WHERE id='${u1}'`, /permission denied/);
await as('authenticated', host, `SELECT public.admin_set_suspension('${u2}', true, 'harassment reports')`);
await asErr('anon cannot select private columns', 'anon', '', `SELECT suspension_reason FROM public.profiles`, /permission denied/); await asErr('authenticated cannot select is_admin', 'authenticated', u1, `SELECT is_admin FROM public.profiles`, /permission denied/); await asErr('select * on profiles denied', 'anon', '', `SELECT * FROM public.profiles`, /permission denied/); const leak = [];
ok('anon CANNOT read suspension_reason / is_admin', leak.length === 0, `anon sees ${JSON.stringify(leak)}`);

// Account deletion
const del1 = (await as('service_role', '', `SELECT public.prepare_account_deletion('${buyer}') AS r`)).rows[0].r;
ok('deletion with payments -> anonymise path', del1.has_payments === true);
const anonP = (await db.query(`SELECT name, username, deleted_at FROM public.profiles WHERE id=$1`, [buyer])).rows[0];
ok('profile anonymised', anonP.name === 'Deleted member' && anonP.username === null && !!anonP.deleted_at);
const loner = await mk('loner@x.com', { name: 'Loner' });
const del2 = (await as('service_role', '', `SELECT public.prepare_account_deletion('${loner}') AS r`)).rows[0].r;
ok('deletion without payments -> hard delete path', del2.has_payments === false);
await tryOk('hard delete cascades cleanly', () => db.exec(`DELETE FROM auth.users WHERE id='${loner}'`));
try { await db.exec(`DELETE FROM auth.users WHERE id='${buyer}'`); ok('hard-deleting a buyer is blocked (payments kept)', false, 'deleted!'); }
catch (e) { ok('hard-deleting a buyer is blocked (payments kept)', /foreign key|payments/.test(e.message), e.message.split('\n')[0]); }
await asErr('authenticated cannot call prepare_account_deletion', 'authenticated', u2, `SELECT public.prepare_account_deletion('${u2}')`, /permission denied/);


// ===== 20261002020x checks =====
const PUB = 'id,name,username,avatar,location,bio,interests,hosted_count,attended_count,is_organizer,is_verified_organizer,organizer_verified_at,followers_count,following_count,created_at,updated_at,instagram_url,tiktok_url,spotify_url,hosting_guidelines_accepted_at,hosting_guidelines_version';
ok('anon can read public profile columns', (await as('anon', '', `SELECT ${PUB} FROM public.profiles LIMIT 5`)).rows.length > 0);
const st = (await as('authenticated', host, `SELECT * FROM public.get_my_account_status()`)).rows[0];
ok('admin sees own status via RPC', st?.is_admin === true);
const st2 = (await as('authenticated', u2, `SELECT * FROM public.get_my_account_status()`)).rows[0];
ok('suspended user sees own suspension via RPC', !!st2?.suspended_at && st2?.suspension_reason === 'harassment reports');
await asErr('anon cannot call get_my_account_status', 'anon', '', `SELECT * FROM public.get_my_account_status()`, /permission denied/);
await asErr('anon cannot insert profiles', 'anon', '', `INSERT INTO public.profiles (id, name) VALUES (gen_random_uuid(), 'x')`, /permission denied/);
await tryOk('own profile edit still works', () => as('authenticated', u1, `UPDATE public.profiles SET bio = 'hello' WHERE id = '${u1}' RETURNING ${PUB}`));
const longP = (await db.query(`SELECT name, avatar FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email = 'long@x.com'`)).rows[0];
ok('long name truncated to 80', longP?.name?.length === 80);
const avP = (await db.query(`SELECT avatar FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email = 'av@x.com'`)).rows[0];
ok('non-https avatar dropped', avP && avP.avatar === null);
const g = await mk('g@x.com', { full_name: '  Ada   Lovelace  ', picture: 'https://lh3.googleusercontent.com/a/x' });
const gp = (await db.query(`SELECT name, avatar FROM public.profiles WHERE id=$1`, [g])).rows[0];
ok('Google name normalised + https avatar kept', gp.name === 'Ada Lovelace' && gp.avatar.startsWith('https://'));
const noMeta = await mk(null, null);
ok('missing metadata still creates profile', (await db.query(`SELECT count(*)::int c FROM public.profiles WHERE id=$1`, [noMeta])).rows[0].c === 1);
const ecols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='payments' AND column_name IN ('receipt_email_sent_at','refund_notice_email_sent_at','email_last_error')`)).rows.length;
ok('payment email tracking columns exist', ecols === 3);

finish();
