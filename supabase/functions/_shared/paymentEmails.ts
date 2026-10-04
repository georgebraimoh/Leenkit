// Sends the email for a payment's current state, at most once per kind.
//
// Used by paystack-webhook, verify-paystack-payment and the scheduled
// email-retry sweeper. The payments row is the outbox (see
// 20261002020200_payment_email_tracking.sql):
//   <kind>_email_sent_at  claim, <kind>_email_id  provider id on success.
// Claims are taken with a conditional UPDATE (optimistic on email_attempts),
// so concurrent callers cannot both send. A claim with no provider id older
// than STALE_CLAIM_MS is retried; Resend's Idempotency-Key (stable per payment
// and kind) prevents a duplicate if the earlier attempt had actually gone out.
// Email problems are logged and never change payment state or responses.
//
// Runtime-agnostic (no Deno APIs, no remote imports): `admin` is any
// service-role Supabase client.
import {
  buildPaymentEmail,
  type EmailConfig,
  isEmailConfigured,
  isValidEmail,
  type PaymentEmailKind,
  sendEmail,
} from "./email.ts";

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export const STALE_CLAIM_MS = 15 * 60 * 1000;
export const MAX_EMAIL_ATTEMPTS = 8;

const COLUMNS: Record<PaymentEmailKind, { sent: string; id: string }> = {
  receipt: { sent: "receipt_email_sent_at", id: "receipt_email_id" },
  payment_not_confirmed: { sent: "refund_notice_email_sent_at", id: "refund_notice_email_id" },
  refund_processed: { sent: "refund_email_sent_at", id: "refund_email_id" },
};

export function emailKindForStatus(status: string): PaymentEmailKind | null {
  if (status === "successful") return "receipt";
  if (status === "requires_refund") return "payment_not_confirmed";
  if (status === "refunded") return "refund_processed";
  return null;
}

export type PaymentEmailOutcome =
  | "sent"
  | "skipped_not_configured"
  | "skipped_no_payment"
  | "skipped_disabled"
  | "skipped_status"
  | "skipped_already_sent"
  | "skipped_in_progress"
  | "skipped_max_attempts"
  | "skipped_no_recipient"
  | "failed";

export async function sendPaymentEmailOnce(
  admin: AdminClient,
  reference: string,
  cfg: EmailConfig,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<PaymentEmailOutcome> {
  if (!isEmailConfigured(cfg)) return "skipped_not_configured";

  const { data: payment, error } = await admin
    .from("payments")
    .select(
      "id, status, payment_type, reference, amount, currency, paid_at, user_id, hangout_id, metadata, " +
        "emails_enabled, email_attempts, receipt_email_sent_at, receipt_email_id, " +
        "refund_notice_email_sent_at, refund_notice_email_id, refund_email_sent_at, refund_email_id",
    )
    .eq("reference", reference)
    .maybeSingle();

  if (error || !payment) return "skipped_no_payment";
  if (payment.emails_enabled === false) return "skipped_disabled";

  const kind = emailKindForStatus(payment.status);
  if (!kind) return "skipped_status";

  const col = COLUMNS[kind];
  const claimedAt: string | null = payment[col.sent] ?? null;
  const providerId: string | null = payment[col.id] ?? null;
  if (providerId) return "skipped_already_sent";
  if (claimedAt && now() - Date.parse(claimedAt) < STALE_CLAIM_MS) return "skipped_in_progress";

  const attempts = Number(payment.email_attempts || 0);
  if (attempts >= MAX_EMAIL_ATTEMPTS) return "skipped_max_attempts";

  let to: string | undefined = payment.metadata?.user_email;
  if (!isValidEmail(to)) {
    const { data: u } = await admin.auth.admin.getUserById(payment.user_id);
    to = u?.user?.email;
  }
  if (!isValidEmail(to)) return "skipped_no_recipient";

  // Claim: matches only if nobody else claimed since we read the row.
  let claim = admin
    .from("payments")
    .update({ [col.sent]: new Date(now()).toISOString(), email_attempts: attempts + 1 })
    .eq("id", payment.id)
    .eq("email_attempts", attempts)
    .is(col.id, null);
  claim = claimedAt ? claim.eq(col.sent, claimedAt) : claim.is(col.sent, null);
  const { data: claimed, error: claimError } = await claim.select("id");

  if (claimError) {
    console.error("payment email claim failed:", claimError.message);
    return "failed";
  }
  if (!claimed || claimed.length === 0) return "skipped_in_progress";

  const { data: hangout } = await admin
    .from("hangouts")
    .select("title, date, time, place_name, city")
    .eq("id", payment.hangout_id)
    .maybeSingle();

  const venue = [hangout?.place_name, hangout?.city].filter(Boolean).join(", ");
  const message = buildPaymentEmail(
    {
      kind,
      paymentType: payment.payment_type === "sponsorship" ? "sponsorship" : "ticket",
      reference: payment.reference,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paid_at,
      hangoutId: payment.hangout_id,
      hangoutTitle: hangout?.title,
      hangoutDate: hangout?.date,
      hangoutTime: hangout?.time,
      venue: venue || null,
      refundReference: payment.metadata?.refund_reference ?? null,
      reason: payment.metadata?.refund_reason ?? null,
    },
    cfg,
  );

  const result = await sendEmail(
    cfg,
    { to, ...message, idempotencyKey: `leenkit-payment-${kind}-${payment.id}` },
    fetchImpl,
  );

  if (result.sent) {
    await admin
      .from("payments")
      .update({ [col.id]: result.id || "sent", email_last_error: null })
      .eq("id", payment.id);
    return "sent";
  }

  // Release the claim so the next webhook, verify call or sweep can retry.
  const reason = "error" in result ? result.error : result.skipped;
  await admin
    .from("payments")
    .update({ [col.sent]: null, email_last_error: String(reason).slice(0, 300) })
    .eq("id", payment.id);
  // Log the payment reference and provider reason only (no address/content).
  console.error(`payment email (${kind}) not sent for ${payment.reference}: ${reason}`);
  return "failed";
}

// Runs email work after the response when the platform supports it
// (Supabase Edge Runtime's waitUntil); otherwise awaits it. Never throws.
export async function runAfterResponse(task: Promise<unknown>): Promise<void> {
  const guarded = task.catch((err) => console.error("background email task failed:", err?.message || err));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(guarded);
    return;
  }
  await guarded;
}
