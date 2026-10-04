// Unit tests for supabase/functions/_shared/email.ts and paymentEmails.ts.
// Fake Resend endpoint + in-memory fake Supabase client. No network, no keys.
// Run: node tests/email/email.test.mts   (Node >= 23.6 runs TypeScript natively)
import * as email from '../../supabase/functions/_shared/email.ts';
import * as pe from '../../supabase/functions/_shared/paymentEmails.ts';

let pass = 0;
let fail = 0;
const failures: string[] = [];
const ok = (n: string, c: boolean, x = '') => {
  if (c) pass++; else { fail++; failures.push(n); }
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
};

// ------------------------------------------------------------ email.ts
const env: Record<string, string> = { RESEND_API_KEY: 're_dummy_for_tests_only', EMAIL_FROM: 'LEENKIT <no-reply@mail.example.com>', APP_URL: 'https://staging.example.com/' };
const cfg = email.emailConfigFromEnv((k: string) => env[k]);
const off = email.emailConfigFromEnv(() => undefined);
ok('config reads env, trims trailing slash, default support email', cfg.appUrl === 'https://staging.example.com' && cfg.supportEmail === 'qleenqapp@gmail.com');
ok('unconfigured detected', !email.isEmailConfigured(off));
ok('escapeHtml', email.escapeHtml(`<b onclick="x">'&`) === '&lt;b onclick=&quot;x&quot;&gt;&#39;&amp;');
ok('email validation', email.isValidEmail('a@b.co') && !email.isValidEmail('a@b') && !email.isValidEmail('x<y>@b.co'));

const receipt = email.buildPaymentEmail({ kind: 'receipt', paymentType: 'ticket', reference: 'LK_TKT_1', amount: 5000, currency: 'NGN', hangoutId: 'h1', hangoutTitle: '<script>alert(1)</script> Party', hangoutDate: '2026-12-01', hangoutTime: '18:00', venue: 'Jabi Lake' }, cfg);
ok('receipt subject', receipt.subject.startsWith('Your ticket for'));
ok('HTML escapes user content', !receipt.html.includes('<script>') && receipt.html.includes('&lt;script&gt;'));
ok('receipt has amount, reference, link', /5,000/.test(receipt.text) && receipt.text.includes('LK_TKT_1') && receipt.text.includes('https://staging.example.com/hangout/h1'));

const noRefundPromise = /we will refund|will be refunded|refund(ed)? within|automatic(ally)? refund|guarantee/i;
const notice = email.buildPaymentEmail({ kind: 'payment_not_confirmed', paymentType: 'ticket', reference: 'R', amount: 1000, currency: 'NGN', hangoutId: 'h1', hangoutTitle: 'X' }, cfg);
ok('not-confirmed notice: no refund promise, asks to contact', !noRefundPromise.test(notice.text) && /contact us/i.test(notice.text) && /not been added as an attendee/.test(notice.text));
const cancelled = email.buildPaymentEmail({ kind: 'payment_not_confirmed', reason: 'hangout_cancelled', paymentType: 'ticket', reference: 'R', amount: 1000, currency: 'NGN', hangoutId: 'h1', hangoutTitle: 'X' }, cfg);
ok('cancellation wording differs and makes no refund promise', cancelled.subject === 'X was cancelled' && !noRefundPromise.test(cancelled.text) && /flagged for review/.test(cancelled.text));
const refunded = email.buildPaymentEmail({ kind: 'refund_processed', paymentType: 'ticket', reference: 'R', amount: 1000, currency: 'NGN', hangoutId: 'h1', hangoutTitle: 'X', refundReference: 'RF_1' }, cfg);
ok('refund email: states issued, shows refund reference, no timing promise', /issued through Paystack/.test(refunded.text) && refunded.text.includes('RF_1') && !/within \d|business days/i.test(refunded.text));

const calls: any[] = [];
const fakeFetch = (status: number, body: any) => (async (url: string, init: any) => {
  calls.push({ url, init });
  return { ok: status < 300, status, json: async () => body } as any;
}) as any;

let r: any = await email.sendEmail(cfg, { to: 'buyer@example.com', subject: 's', html: 'h', text: 't', idempotencyKey: 'k1' }, fakeFetch(200, { id: 'em_1' }));
ok('send ok returns provider id', r.sent === true && r.id === 'em_1');
ok('auth + idempotency headers, correct endpoint', calls[0].url === 'https://api.resend.com/emails' && calls[0].init.headers.Authorization === 'Bearer re_dummy_for_tests_only' && calls[0].init.headers['Idempotency-Key'] === 'k1');
r = await email.sendEmail(cfg, { to: 'buyer@example.com', subject: 's', html: 'h', text: 't' }, fakeFetch(422, { message: 'domain not verified' }));
ok('provider error surfaced', r.sent === false && r.error === 'domain not verified');
r = await email.sendEmail(cfg, { to: 'bad', subject: 's', html: 'h', text: 't' }, fakeFetch(200, {}));
ok('invalid recipient skipped', r.sent === false && r.skipped === 'invalid_recipient');
r = await email.sendEmail(off, { to: 'a@b.co', subject: 's', html: 'h', text: 't' }, fakeFetch(200, {}));
ok('unconfigured skipped', r.skipped === 'email_not_configured');
r = await email.sendEmail(cfg, { to: 'a@b.co', subject: 's', html: 'h', text: 't' }, (async () => { throw new Error('network down'); }) as any);
ok('network error captured, not thrown', r.sent === false && r.error === 'network down');

// ------------------------------------------------- paymentEmails.ts
// Minimal fake of the supabase-js query builder used by paymentEmails.ts.
function fakeAdmin(payments: any[], hangouts: any[] = [], users: Record<string, string> = {}) {
  const tables: Record<string, any[]> = { payments, hangouts };
  return {
    tables,
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: users[id] ? { email: users[id] } : null } }) } },
    from(table: string) {
      const rows = tables[table];
      const q: any = { filters: [] as ((row: any) => boolean)[], patch: null as any };
      q.select = () => q;
      q.update = (p: any) => { q.patch = p; return q; };
      q.eq = (c: string, v: any) => { q.filters.push((row: any) => row[c] === v); return q; };
      q.is = (c: string, v: any) => { q.filters.push((row: any) => (row[c] ?? null) === v); return q; };
      const run = () => {
        const hit = rows.filter((row: any) => q.filters.every((f: any) => f(row)));
        if (q.patch) hit.forEach((row: any) => Object.assign(row, q.patch));
        return hit;
      };
      q.maybeSingle = async () => ({ data: run()[0] ?? null, error: null });
      q.then = (res: any, rej: any) => Promise.resolve({ data: run(), error: null }).then(res, rej);
      return q;
    },
  };
}

const NOW = Date.parse('2026-10-04T12:00:00Z');
const clock = () => NOW;
const pay = (over: any = {}) => ({
  id: 'p1', status: 'successful', payment_type: 'ticket', reference: 'REF1', amount: 5000, currency: 'NGN', paid_at: '2026-10-04T10:00:00Z',
  user_id: 'u1', hangout_id: 'h1', metadata: { user_email: 'buyer@example.com' }, emails_enabled: true, email_attempts: 0,
  receipt_email_sent_at: null, receipt_email_id: null, refund_notice_email_sent_at: null, refund_notice_email_id: null,
  refund_email_sent_at: null, refund_email_id: null, email_last_error: null, ...over,
});
const hang = [{ id: 'h1', title: 'Board Games', date: '2026-12-01', time: '18:00', place_name: 'Cafe', city: 'Abuja' }];
const send = (a: any, f: any = fakeFetch(200, { id: 'em_x' })) => pe.sendPaymentEmailOnce(a, 'REF1', cfg, f, clock);

calls.length = 0;
let a = fakeAdmin([pay()], hang);
ok('first send -> sent', (await send(a)) === 'sent');
ok('provider id recorded, attempts counted', a.tables.payments[0].receipt_email_id === 'em_x' && a.tables.payments[0].email_attempts === 1);
ok('webhook retry / verify after success -> no second email', (await send(a)) === 'skipped_already_sent' && calls.length === 1);

a = fakeAdmin([pay()], hang);
const both = await Promise.all([send(a), send(a)]);
ok('concurrent webhook + verify -> exactly one sent', both.filter((x) => x === 'sent').length === 1, both.join(','));

a = fakeAdmin([pay()], hang);
ok('provider failure -> failed', (await send(a, fakeFetch(500, { message: 'boom' }))) === 'failed');
ok('claim released + error stored', a.tables.payments[0].receipt_email_sent_at === null && a.tables.payments[0].email_last_error === 'boom');
ok('retry after failure succeeds and clears error', (await send(a)) === 'sent' && a.tables.payments[0].email_last_error === null);

// Function died after claiming (claim set, no provider id):
a = fakeAdmin([pay({ receipt_email_sent_at: new Date(NOW - 60 * 1000).toISOString(), email_attempts: 1 })], hang);
ok('fresh claim without id -> in progress, not resent', (await send(a)) === 'skipped_in_progress');
a = fakeAdmin([pay({ receipt_email_sent_at: new Date(NOW - 20 * 60 * 1000).toISOString(), email_attempts: 1 })], hang);
calls.length = 0;
ok('stale claim (>15 min, no id) is retried', (await send(a)) === 'sent' && calls.length === 1);
ok('retry reuses the same idempotency key (provider de-dupes)', calls[0].init.headers['Idempotency-Key'] === 'leenkit-payment-receipt-p1');

a = fakeAdmin([pay({ email_attempts: pe.MAX_EMAIL_ATTEMPTS })], hang);
ok('attempt cap stops retries', (await send(a)) === 'skipped_max_attempts');
a = fakeAdmin([pay({ emails_enabled: false })], hang);
ok('payments from before the feature never get emails', (await send(a)) === 'skipped_disabled');

calls.length = 0;
a = fakeAdmin([pay({ status: 'requires_refund', metadata: { user_email: 'buyer@example.com', refund_reason: 'LEENKIT_CAPACITY_EXCEEDED' } })], hang);
ok('requires_refund -> not-confirmed notice', (await send(a)) === 'sent' && JSON.parse(calls[0].init.body).subject.startsWith('About your payment'));
calls.length = 0;
a = fakeAdmin([pay({ status: 'requires_refund', metadata: { user_email: 'buyer@example.com', refund_reason: 'hangout_cancelled' } })], hang);
ok('cancelled Hangout -> cancellation notice', (await send(a)) === 'sent' && JSON.parse(calls[0].init.body).subject === 'Board Games was cancelled');
calls.length = 0;
a = fakeAdmin([pay({ status: 'refunded', metadata: { user_email: 'buyer@example.com', refund_reference: 'RF_9' } })], hang);
ok('refunded (admin recorded Paystack ref) -> refund email', (await send(a)) === 'sent' && JSON.parse(calls[0].init.body).text.includes('RF_9') && !!a.tables.payments[0].refund_email_id);
ok('kinds tracked separately (receipt column untouched)', a.tables.payments[0].receipt_email_id === null);

for (const st of ['pending', 'flagged_mismatch', 'failed']) {
  a = fakeAdmin([pay({ status: st })], hang);
  ok(`status ${st} -> no email`, (await send(a)) === 'skipped_status');
}
calls.length = 0;
a = fakeAdmin([pay({ metadata: {} })], hang, { u1: 'fromauth@example.com' });
ok('falls back to auth email', (await send(a)) === 'sent' && JSON.parse(calls[0].init.body).to[0] === 'fromauth@example.com');
a = fakeAdmin([pay({ metadata: {} })], hang, {});
ok('no recipient -> skipped, nothing claimed', (await send(a)) === 'skipped_no_recipient' && a.tables.payments[0].receipt_email_sent_at === null);
a = fakeAdmin([pay()], hang);
ok('unconfigured -> skipped, nothing claimed', (await pe.sendPaymentEmailOnce(a, 'REF1', off, fakeFetch(200, {}), clock)) === 'skipped_not_configured' && a.tables.payments[0].receipt_email_sent_at === null);
ok('unknown reference -> skipped', (await pe.sendPaymentEmailOnce(fakeAdmin([]), 'NOPE', cfg, fakeFetch(200, {}), clock)) === 'skipped_no_payment');

let threw = false;
try { await pe.runAfterResponse(Promise.reject(new Error('x'))); } catch { threw = true; }
ok('runAfterResponse never throws', !threw);

console.log(`\nRESULT email: pass=${pass} fail=${fail}`);
if (fail > 0) { console.log(`Failed: ${failures.join('; ')}`); process.exitCode = 1; }
