// Refunds and host payouts through Paystack.
//
// Policy and ledger live in the database (20261004000000_refunds_and_held_payouts):
//   payments.status = 'requires_refund' + refund_status = 'queued'  -> refund to submit
//   host_payouts.status = 'scheduled' and due                        -> transfer to send
// This module moves those rows forward using the Paystack Refund and
// Transfer APIs, and applies refund.* / transfer.* webhook events.
//
// Safety rules:
//   * Every row is claimed with a conditional UPDATE before calling Paystack,
//     so two runs never act on the same row.
//   * Refunds: a submission whose outcome is unknown (crash/time-out while
//     "submitting") is moved to needs_review, never resubmitted
//     automatically. Paystack also rejects refunds above the remaining
//     transaction amount.
//   * Transfers: each attempt uses a unique reference stored before the call;
//     an unknown outcome is resolved later with GET /transfer/verify/:reference
//     instead of sending again.
//   * Payouts are only sent when platform_settings.payments.payouts_enabled.
//
// Runtime-agnostic (no Deno APIs, no remote imports) so it can be unit-tested.

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export type PaystackResponse = { ok: boolean; status: number; body: any };
export type Paystack = (path: string, init?: { method?: string; body?: unknown }) => Promise<PaystackResponse>;

export const STALE_SUBMISSION_MS = 15 * 60 * 1000;
export const TRANSFER_VERIFY_AFTER_MS = 10 * 60 * 1000;
export const MAX_REFUND_ATTEMPTS = 5;

export function paystackClient(secretKey: string, fetchImpl: typeof fetch = fetch): Paystack {
  return async (path, init = {}) => {
    try {
      const res = await fetchImpl(`https://api.paystack.co${path}`, {
        method: init.method || "GET",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok && body?.status !== false, status: res.status, body };
    } catch (err) {
      // Network failure: outcome unknown.
      return { ok: false, status: 0, body: { message: String((err as Error)?.message || err) } };
    }
  };
}

export type PaymentSettings = { refundsEnabled: boolean; payoutsEnabled: boolean };

export async function getPaymentSettings(admin: AdminClient): Promise<PaymentSettings> {
  const { data } = await admin.from("platform_settings").select("value").eq("key", "payments").maybeSingle();
  const v = data?.value || {};
  return { refundsEnabled: v.refunds_enabled !== false, payoutsEnabled: v.payouts_enabled === true };
}

const kobo = (amount: number) => Math.round(Number(amount) * 100);
const msg = (r: PaystackResponse) => String(r.body?.message || `Paystack request failed (${r.status})`).slice(0, 300);

// ---------------------------------------------------------------- refunds
export type RefundSummary = { submitted: number; processed: number; needsReview: number; requeued: number; skipped?: string };

// mode: 'live' or 'test', from the secret key in use. Refunds are only
// submitted for payments made in the same mode (never test refunds with
// live keys); payments of unknown mode are left for an admin.
export function modeForSecretKey(secretKey: string): "live" | "test" {
  return secretKey.startsWith("sk_live_") ? "live" : "test";
}

export async function processRefunds(
  admin: AdminClient,
  paystack: Paystack,
  opts: { limit?: number; now?: () => number; settings?: PaymentSettings; mode?: "live" | "test" } = {},
): Promise<RefundSummary> {
  const now = opts.now || Date.now;
  const settings = opts.settings || (await getPaymentSettings(admin));
  const summary: RefundSummary = { submitted: 0, processed: 0, needsReview: 0, requeued: 0 };
  if (!settings.refundsEnabled) return { ...summary, skipped: "refunds_disabled" };

  // 1. Submissions with an unknown outcome go to a human, never resubmitted.
  const staleBefore = new Date(now() - STALE_SUBMISSION_MS).toISOString();
  const { data: stale } = await admin
    .from("payments")
    .update({ refund_status: "needs_review", refund_last_error: "Refund submission outcome unknown; check the Paystack dashboard before retrying." })
    .eq("status", "requires_refund")
    .eq("refund_status", "submitting")
    .lt("refund_submitted_at", staleBefore)
    .select("id");
  summary.needsReview += stale?.length || 0;

  // 2. Submit queued refunds.
  const { data: queued } = await admin
    .from("payments")
    .select("id, reference, amount, currency, refund_amount, refund_reason, refund_attempts")
    .eq("status", "requires_refund")
    .eq("refund_status", "queued")
    .eq("paystack_mode", opts.mode || "live")
    .order("refund_requested_at", { ascending: true })
    .limit(opts.limit || 25);

  for (const p of queued || []) {
    const amount = Number(p.refund_amount ?? p.amount);
    if (!(amount > 0)) continue;
    const attempts = Number(p.refund_attempts || 0);

    const { data: claimed } = await admin
      .from("payments")
      .update({ refund_status: "submitting", refund_submitted_at: new Date(now()).toISOString(), refund_attempts: attempts + 1 })
      .eq("id", p.id)
      .eq("refund_status", "queued")
      .eq("refund_attempts", attempts)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const res = await paystack("/refund", {
      method: "POST",
      body: {
        transaction: p.reference,
        amount: kobo(amount),
        currency: p.currency,
        customer_note: p.refund_reason === "attendee_left" ? "Refund for leaving a LEENKIT Hangout" : "Refund from LEENKIT",
        merchant_note: `LEENKIT ${p.refund_reason || "refund"} (payment ${p.id})`,
      },
    });

    if (res.ok) {
      const st = String(res.body?.data?.status || "pending");
      const refundStatus = ["pending", "processing", "processed", "failed"].includes(st) ? st : "pending";
      await admin
        .from("payments")
        .update({ refund_status: refundStatus === "processed" ? "processing" : refundStatus, paystack_refund_id: res.body?.data?.id != null ? String(res.body.data.id) : null, refund_last_error: null })
        .eq("id", p.id);
      if (refundStatus === "processed") {
        await admin.rpc("complete_payment_refund", { p_reference: p.reference, p_amount: amount });
        summary.processed++;
      }
      summary.submitted++;
    } else if (res.status === 0 || res.status >= 500) {
      // Transient: requeue (Paystack rejects a second refund above the
      // remaining amount, so a duplicate cannot over-refund).
      const next = attempts + 1 >= MAX_REFUND_ATTEMPTS ? "needs_review" : "queued";
      await admin.from("payments").update({ refund_status: next, refund_last_error: msg(res) }).eq("id", p.id);
      if (next === "needs_review") summary.needsReview++; else summary.requeued++;
    } else {
      // Rejected by Paystack (e.g. already reversed, invalid amount): a human decides.
      await admin.from("payments").update({ refund_status: "needs_review", refund_last_error: msg(res) }).eq("id", p.id);
      summary.needsReview++;
    }
  }
  return summary;
}

// Webhook: refund.pending | refund.processing | refund.processed | refund.failed
export async function applyRefundEvent(admin: AdminClient, event: string, data: any): Promise<string> {
  const reference = data?.transaction_reference || data?.transaction?.reference;
  if (!reference) return "no_reference";

  if (event === "refund.processed") {
    const amount = data?.amount != null ? Number(data.amount) / 100 : null;
    const { data: result, error } = await admin.rpc("complete_payment_refund", { p_reference: reference, p_amount: amount });
    if (error) throw new Error(error.message);
    return String(result);
  }

  const map: Record<string, string> = { "refund.pending": "pending", "refund.processing": "processing", "refund.failed": "failed" };
  const refundStatus = map[event];
  if (!refundStatus) return "ignored";

  const patch: Record<string, unknown> = { refund_status: refundStatus };
  if (refundStatus === "failed") patch.refund_last_error = String(data?.reason || data?.status || "Refund failed at Paystack").slice(0, 300);
  const { data: rows } = await admin
    .from("payments")
    .update(patch)
    .eq("reference", reference)
    .eq("status", "requires_refund")
    .select("id");
  return rows && rows.length ? refundStatus : "not_pending";
}

// ---------------------------------------------------------------- payouts
export type PayoutSummary = { scheduled: number; sent: number; paid: number; failed: number; needsReview: number; verified: number; skipped?: string };

export async function processPayouts(
  admin: AdminClient,
  paystack: Paystack,
  opts: { limit?: number; now?: () => number; settings?: PaymentSettings } = {},
): Promise<PayoutSummary> {
  const now = opts.now || Date.now;
  const settings = opts.settings || (await getPaymentSettings(admin));
  const summary: PayoutSummary = { scheduled: 0, sent: 0, paid: 0, failed: 0, needsReview: 0, verified: 0 };

  // The ledger is always kept up to date so hosts see what is coming.
  const { data: scheduledCount, error: schedError } = await admin.rpc("schedule_host_payouts");
  if (schedError) throw new Error(`schedule_host_payouts failed: ${schedError.message}`);
  summary.scheduled = Number(scheduledCount || 0);

  if (!settings.payoutsEnabled) return { ...summary, skipped: "payouts_disabled" };

  // 1. Resolve transfers whose outcome is not known yet.
  const verifyBefore = new Date(now() - TRANSFER_VERIFY_AFTER_MS).toISOString();
  const { data: inFlight } = await admin
    .from("host_payouts")
    .select("id, transfer_reference")
    .eq("status", "processing")
    .lt("processing_started_at", verifyBefore)
    .limit(opts.limit || 25);
  for (const p of inFlight || []) {
    const res = await paystack(`/transfer/verify/${encodeURIComponent(p.transfer_reference)}`);
    summary.verified++;
    if (res.ok) {
      const st = String(res.body?.data?.status || "");
      if (st === "success") {
        await admin.from("host_payouts").update({ status: "paid", paid_at: new Date(now()).toISOString(), updated_at: new Date(now()).toISOString() }).eq("id", p.id).eq("status", "processing");
        summary.paid++;
      } else if (st === "failed" || st === "reversed") {
        await admin.from("host_payouts").update({ status: "failed", failure_reason: `Transfer ${st}`, updated_at: new Date(now()).toISOString() }).eq("id", p.id).eq("status", "processing");
        summary.failed++;
      }
    } else if (res.status === 404) {
      // The transfer was never created: safe to try again with the same reference.
      await admin.from("host_payouts").update({ status: "scheduled", processing_started_at: null, updated_at: new Date(now()).toISOString() }).eq("id", p.id).eq("status", "processing");
    }
  }

  // 2. Send due payouts.
  const { data: due } = await admin
    .from("host_payouts")
    .select("id, host_id, amount, currency, transfer_reference, attempts, hangout_id")
    .eq("status", "scheduled")
    .lte("available_at", new Date(now()).toISOString())
    .order("available_at", { ascending: true })
    .limit(opts.limit || 25);

  for (const p of due || []) {
    // Always pay the host's current payout account.
    const { data: acct } = await admin
      .from("host_payout_accounts")
      .select("paystack_recipient_code")
      .eq("user_id", p.host_id)
      .maybeSingle();
    if (!acct?.paystack_recipient_code) {
      await admin.from("host_payouts").update({ status: "needs_review", failure_reason: "host_has_no_payout_recipient", updated_at: new Date(now()).toISOString() }).eq("id", p.id).eq("status", "scheduled");
      summary.needsReview++;
      continue;
    }

    const attempts = Number(p.attempts || 0);
    const { data: claimed } = await admin
      .from("host_payouts")
      .update({ status: "processing", attempts: attempts + 1, recipient_code: acct.paystack_recipient_code, processing_started_at: new Date(now()).toISOString(), updated_at: new Date(now()).toISOString() })
      .eq("id", p.id)
      .eq("status", "scheduled")
      .eq("attempts", attempts)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const res = await paystack("/transfer", {
      method: "POST",
      body: {
        source: "balance",
        amount: kobo(p.amount),
        currency: p.currency || "NGN",
        recipient: acct.paystack_recipient_code,
        reference: p.transfer_reference,
        reason: "LEENKIT Hangout payout",
      },
    });
    summary.sent++;

    if (res.ok) {
      const st = String(res.body?.data?.status || "pending");
      const code = res.body?.data?.transfer_code ? String(res.body.data.transfer_code) : null;
      if (st === "success") {
        await admin.from("host_payouts").update({ status: "paid", paid_at: new Date(now()).toISOString(), paystack_transfer_code: code, updated_at: new Date(now()).toISOString() }).eq("id", p.id);
        summary.paid++;
      } else if (st === "otp") {
        await admin.from("host_payouts").update({ status: "needs_review", paystack_transfer_code: code, failure_reason: "Paystack requires an OTP for transfers. Disable transfer OTP in the Paystack dashboard, then finalise or retry.", updated_at: new Date(now()).toISOString() }).eq("id", p.id);
        summary.needsReview++;
      } else if (st === "failed" || st === "reversed") {
        await admin.from("host_payouts").update({ status: "failed", paystack_transfer_code: code, failure_reason: `Transfer ${st}`, updated_at: new Date(now()).toISOString() }).eq("id", p.id);
        summary.failed++;
      } else {
        // pending / received / queued: the transfer.* webhook (or verify) completes it.
        await admin.from("host_payouts").update({ paystack_transfer_code: code, updated_at: new Date(now()).toISOString() }).eq("id", p.id);
      }
    } else if (res.status === 0 || res.status >= 500) {
      // Unknown outcome: stays 'processing'; step 1 verifies it by reference later.
      await admin.from("host_payouts").update({ failure_reason: msg(res), updated_at: new Date(now()).toISOString() }).eq("id", p.id);
    } else {
      // Rejected (e.g. insufficient balance, invalid recipient): admin retries.
      await admin.from("host_payouts").update({ status: "failed", failure_reason: msg(res), updated_at: new Date(now()).toISOString() }).eq("id", p.id);
      summary.failed++;
    }
  }
  return summary;
}

// Webhook: transfer.success | transfer.failed | transfer.reversed
export async function applyTransferEvent(admin: AdminClient, event: string, data: any): Promise<string> {
  const reference = data?.reference;
  if (!reference || !String(reference).startsWith("LKP_")) return "not_a_payout";
  const now = new Date().toISOString();

  if (event === "transfer.success") {
    const { data: rows } = await admin
      .from("host_payouts")
      .update({ status: "paid", paid_at: now, paystack_transfer_code: data?.transfer_code ?? null, updated_at: now })
      .eq("transfer_reference", reference)
      .in("status", ["processing", "needs_review"])
      .select("id");
    return rows && rows.length ? "paid" : "no_change";
  }
  if (event === "transfer.failed" || event === "transfer.reversed") {
    const { data: rows } = await admin
      .from("host_payouts")
      .update({ status: "failed", failure_reason: `Transfer ${event.split(".")[1]}`, updated_at: now })
      .eq("transfer_reference", reference)
      .in("status", ["processing", "needs_review", "paid"])
      .select("id");
    return rows && rows.length ? "failed" : "no_change";
  }
  return "ignored";
}
