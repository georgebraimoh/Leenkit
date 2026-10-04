// Unit tests for supabase/functions/_shared/paymentJobs.ts (refunds + host
// payouts) with a fake Paystack API and an in-memory fake Supabase client.
// No network, no keys. Run: node tests/payments/jobs.test.mts
import * as jobs from '../../supabase/functions/_shared/paymentJobs.ts';

let pass = 0;
let fail = 0;
const failures: string[] = [];
const ok = (n: string, c: boolean, x = '') => {
  if (c) pass++; else { fail++; failures.push(n); }
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
};

// ---------------------------------------------------------------- fakes
function fakeAdmin(init: { payments?: any[]; host_payouts?: any[]; host_payout_accounts?: any[]; settings?: any; scheduleCount?: number }) {
  const tables: Record<string, any[]> = {
    payments: init.payments || [],
    host_payouts: init.host_payouts || [],
    host_payout_accounts: init.host_payout_accounts || [],
    platform_settings: [{ key: 'payments', value: init.settings || { refunds_enabled: true, payouts_enabled: true } }],
  };
  const rpcCalls: any[] = [];
  return {
    tables,
    rpcCalls,
    async rpc(name: string, args: any) {
      rpcCalls.push({ name, args });
      if (name === 'schedule_host_payouts') return { data: init.scheduleCount ?? 0, error: null };
      if (name === 'complete_payment_refund') {
        const p = tables.payments.find((r) => r.reference === args.p_reference);
        if (!p) return { data: 'not_found', error: null };
        if (p.status === 'refunded') return { data: 'already_refunded', error: null };
        Object.assign(p, { status: 'refunded', refund_status: 'processed' });
        return { data: 'refunded', error: null };
      }
      return { data: null, error: { message: 'unknown rpc' } };
    },
    from(table: string) {
      const rows = tables[table];
      const q: any = { filters: [] as ((r: any) => boolean)[], patch: null as any, lim: Infinity };
      q.select = () => q;
      q.update = (p: any) => { q.patch = p; return q; };
      q.eq = (c: string, v: any) => { q.filters.push((r: any) => r[c] === v); return q; };
      q.is = (c: string, v: any) => { q.filters.push((r: any) => (r[c] ?? null) === v); return q; };
      q.in = (c: string, vs: any[]) => { q.filters.push((r: any) => vs.includes(r[c])); return q; };
      q.lt = (c: string, v: any) => { q.filters.push((r: any) => r[c] != null && r[c] < v); return q; };
      q.lte = (c: string, v: any) => { q.filters.push((r: any) => r[c] != null && r[c] <= v); return q; };
      q.order = () => q;
      q.limit = (n: number) => { q.lim = n; return q; };
      const run = () => {
        const hit = rows.filter((r: any) => q.filters.every((f: any) => f(r))).slice(0, q.lim);
        if (q.patch) hit.forEach((r: any) => Object.assign(r, q.patch));
        return hit;
      };
      q.maybeSingle = async () => ({ data: run()[0] ?? null, error: null });
      q.then = (res: any, rej: any) => Promise.resolve({ data: run(), error: null }).then(res, rej);
      return q;
    },
  };
}

function fakePaystack(handler: (path: string, init: any) => jobs.PaystackResponse) {
  const calls: { path: string; init: any }[] = [];
  const fn: jobs.Paystack = async (path, init = {}) => { calls.push({ path, init }); return handler(path, init); };
  return { fn, calls };
}

const NOW = Date.parse('2026-10-05T12:00:00Z');
const clock = () => NOW;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const refundRow = (over: any = {}) => ({ id: 'p1', reference: 'REF1', amount: 5000, currency: 'NGN', status: 'requires_refund', refund_status: 'queued', refund_amount: 4500, refund_reason: 'attendee_left', refund_attempts: 0, refund_requested_at: iso(60000), ...over });

// ---------------------------------------------------------------- refunds
{
  const admin = fakeAdmin({ payments: [refundRow()], settings: { refunds_enabled: false } });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: {} }));
  const r = await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('refunds disabled -> nothing sent', r.skipped === 'refunds_disabled' && ps.calls.length === 0);
}
{
  const admin = fakeAdmin({ payments: [refundRow()] });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: { status: true, data: { id: 991, status: 'pending' } } }));
  const r = await jobs.processRefunds(admin, ps.fn, { now: clock });
  const p = admin.tables.payments[0];
  ok('queued refund submitted once', ps.calls.length === 1 && r.submitted === 1);
  ok('refund request: reference + kobo amount', ps.calls[0].path === '/refund' && ps.calls[0].init.body.transaction === 'REF1' && ps.calls[0].init.body.amount === 450000);
  ok('refund marked pending with Paystack id', p.refund_status === 'pending' && p.paystack_refund_id === '991' && p.refund_attempts === 1);
  const again = await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('pending refund not resubmitted', ps.calls.length === 1 && again.submitted === 0);
}
{
  const admin = fakeAdmin({ payments: [refundRow()] });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: { status: true, data: { id: 1, status: 'processed' } } }));
  await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('immediately processed refund completes the payment', admin.tables.payments[0].status === 'refunded' && admin.rpcCalls.some((c) => c.name === 'complete_payment_refund'));
}
{
  const admin = fakeAdmin({ payments: [refundRow()] });
  const ps = fakePaystack(() => ({ ok: false, status: 503, body: { message: 'Service unavailable' } }));
  await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('Paystack outage -> requeued with error', admin.tables.payments[0].refund_status === 'queued' && admin.tables.payments[0].refund_last_error === 'Service unavailable');
  for (let i = 0; i < 6; i++) await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('gives up after max attempts -> needs_review', admin.tables.payments[0].refund_status === 'needs_review' && admin.tables.payments[0].refund_attempts === jobs.MAX_REFUND_ATTEMPTS);
}
{
  const admin = fakeAdmin({ payments: [refundRow()] });
  const ps = fakePaystack(() => ({ ok: false, status: 400, body: { status: false, message: 'Transaction has been fully reversed' } }));
  await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('Paystack rejection -> needs_review (no retry)', admin.tables.payments[0].refund_status === 'needs_review' && /fully reversed/.test(admin.tables.payments[0].refund_last_error));
}
{
  const admin = fakeAdmin({ payments: [refundRow({ refund_status: 'submitting', refund_submitted_at: iso(20 * 60 * 1000) })] });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: {} }));
  const r = await jobs.processRefunds(admin, ps.fn, { now: clock });
  ok('unknown-outcome submission -> needs_review, never resubmitted', admin.tables.payments[0].refund_status === 'needs_review' && ps.calls.length === 0 && r.needsReview === 1);
}
{
  const admin = fakeAdmin({ payments: [refundRow()] });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: { status: true, data: { id: 5, status: 'pending' } } }));
  await Promise.all([jobs.processRefunds(admin, ps.fn, { now: clock }), jobs.processRefunds(admin, ps.fn, { now: clock })]);
  ok('two concurrent runs submit the refund once', ps.calls.length === 1);
}
{
  const admin = fakeAdmin({ payments: [refundRow({ refund_status: 'pending' })] });
  ok('refund.processed webhook completes payment', (await jobs.applyRefundEvent(admin, 'refund.processed', { transaction_reference: 'REF1', amount: '450000' })) === 'refunded' && admin.tables.payments[0].status === 'refunded');
  ok('duplicate refund.processed is harmless', (await jobs.applyRefundEvent(admin, 'refund.processed', { transaction_reference: 'REF1' })) === 'already_refunded');
  const admin2 = fakeAdmin({ payments: [refundRow({ refund_status: 'pending' })] });
  await jobs.applyRefundEvent(admin2, 'refund.failed', { transaction_reference: 'REF1', status: 'failed' });
  ok('refund.failed -> failed for admin follow-up', admin2.tables.payments[0].refund_status === 'failed');
  ok('event without reference ignored', (await jobs.applyRefundEvent(admin2, 'refund.processed', {})) === 'no_reference');
}

// ---------------------------------------------------------------- payouts
const payoutRow = (over: any = {}) => ({ id: 'po1', host_id: 'h1', hangout_id: 'g1', amount: 13500, currency: 'NGN', status: 'scheduled', transfer_reference: 'LKP_abc', attempts: 0, available_at: iso(60 * 60 * 1000), ...over });
const acct = [{ user_id: 'h1', paystack_recipient_code: 'RCP_current' }];

{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: acct, settings: { refunds_enabled: true, payouts_enabled: false }, scheduleCount: 2 });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: {} }));
  const r = await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('payouts disabled: ledger scheduled, no transfers sent', r.skipped === 'payouts_disabled' && r.scheduled === 2 && ps.calls.length === 0 && admin.rpcCalls[0].name === 'schedule_host_payouts');
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: acct });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: { status: true, data: { status: 'success', transfer_code: 'TRF_1' } } }));
  const r = await jobs.processPayouts(admin, ps.fn, { now: clock });
  const t = ps.calls[0]?.init.body;
  ok('due payout transferred to current recipient with its reference', ps.calls[0]?.path === '/transfer' && t.recipient === 'RCP_current' && t.reference === 'LKP_abc' && t.amount === 1350000 && t.source === 'balance');
  ok('successful transfer -> paid', admin.tables.host_payouts[0].status === 'paid' && admin.tables.host_payouts[0].paystack_transfer_code === 'TRF_1' && r.paid === 1);
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow({ available_at: new Date(NOW + 3600e3).toISOString() })], host_payout_accounts: acct });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: {} }));
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('not yet due -> not sent', ps.calls.length === 0 && admin.tables.host_payouts[0].status === 'scheduled');
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: acct });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: { status: true, data: { status: 'pending', transfer_code: 'TRF_2' } } }));
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('pending transfer stays processing (webhook completes it)', admin.tables.host_payouts[0].status === 'processing' && admin.tables.host_payouts[0].paystack_transfer_code === 'TRF_2');
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('processing payout is not sent twice', ps.calls.filter((c) => c.path === '/transfer').length === 1);
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: acct });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: { status: true, data: { status: 'otp', transfer_code: 'TRF_3' } } }));
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('OTP required -> needs_review with instructions', admin.tables.host_payouts[0].status === 'needs_review' && /OTP/.test(admin.tables.host_payouts[0].failure_reason));
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: acct });
  const ps = fakePaystack(() => ({ ok: false, status: 400, body: { status: false, message: 'Your balance is not enough to fulfil this request' } }));
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('rejected transfer (e.g. low balance) -> failed for admin retry', admin.tables.host_payouts[0].status === 'failed' && /balance/.test(admin.tables.host_payouts[0].failure_reason));
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: acct });
  let first = true;
  const ps = fakePaystack((path) => {
    if (path === '/transfer' && first) { first = false; return { ok: false, status: 0, body: { message: 'timeout' } }; }
    if (path.startsWith('/transfer/verify/')) return { ok: true, status: 200, body: { status: true, data: { status: 'success' } } };
    return { ok: true, status: 200, body: {} };
  });
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('unknown outcome stays processing (no resend)', admin.tables.host_payouts[0].status === 'processing');
  await jobs.processPayouts(admin, ps.fn, { now: () => NOW + 11 * 60 * 1000 });
  ok('verified by reference later -> paid, still one transfer call', admin.tables.host_payouts[0].status === 'paid' && ps.calls.filter((c) => c.path === '/transfer').length === 1);
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow({ status: 'processing', attempts: 1, processing_started_at: iso(20 * 60 * 1000) })], host_payout_accounts: acct });
  const ps = fakePaystack((path) => (path.startsWith('/transfer/verify/') ? { ok: false, status: 404, body: { message: 'Transfer not found' } } : { ok: true, status: 200, body: { status: true, data: { status: 'success' } } }));
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('transfer never created -> rescheduled and sent with same reference', admin.tables.host_payouts[0].status === 'paid' && ps.calls.some((c) => c.path === '/transfer' && c.init.body.reference === 'LKP_abc'));
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow()], host_payout_accounts: [] });
  const ps = fakePaystack(() => ({ ok: true, status: 200, body: {} }));
  await jobs.processPayouts(admin, ps.fn, { now: clock });
  ok('host without recipient -> needs_review, nothing sent', admin.tables.host_payouts[0].status === 'needs_review' && ps.calls.length === 0);
}
{
  const admin = fakeAdmin({ host_payouts: [payoutRow({ status: 'processing' })] });
  ok('transfer.success -> paid', (await jobs.applyTransferEvent(admin, 'transfer.success', { reference: 'LKP_abc', transfer_code: 'TRF_9' })) === 'paid' && admin.tables.host_payouts[0].status === 'paid');
  const admin2 = fakeAdmin({ host_payouts: [payoutRow({ status: 'processing' })] });
  ok('transfer.failed -> failed', (await jobs.applyTransferEvent(admin2, 'transfer.failed', { reference: 'LKP_abc' })) === 'failed');
  ok('transfers that are not LEENKIT payouts are ignored', (await jobs.applyTransferEvent(admin2, 'transfer.success', { reference: 'other_ref' })) === 'not_a_payout');
}

// ---------------------------------------------------------------- client
{
  const seen: any[] = [];
  const client = jobs.paystackClient('sk_dummy', (async (url: string, init: any) => { seen.push({ url, init }); return { ok: true, status: 200, json: async () => ({ status: true, data: {} }) } as any; }) as any);
  const r = await client('/refund', { method: 'POST', body: { transaction: 'X' } });
  ok('client: bearer auth, JSON body, Paystack base URL', r.ok && seen[0].url === 'https://api.paystack.co/refund' && seen[0].init.headers.Authorization === 'Bearer sk_dummy' && JSON.parse(seen[0].init.body).transaction === 'X');
  const down = jobs.paystackClient('k', (async () => { throw new Error('ECONNRESET'); }) as any);
  const d = await down('/transfer');
  ok('client: network error -> status 0, never throws', d.ok === false && d.status === 0);
}

console.log(`\nRESULT payments: pass=${pass} fail=${fail}`);
if (fail > 0) { console.log(`Failed: ${failures.join('; ')}`); process.exitCode = 1; }
