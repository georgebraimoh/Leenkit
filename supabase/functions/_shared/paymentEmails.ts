// Sends the payment email for a settled payment, at most once.
//
// Called by paystack-webhook and verify-paystack-payment after
// settle_payment(). Both may run for the same payment and Paystack retries
// webhooks, so the send is claimed first with a conditional UPDATE on
// payments.<kind>_email_sent_at (see 20261002020200_payment_email_tracking).
// Email problems are logged and never change the payment or the response.
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

const COLUMN: Record<PaymentEmailKind, string> = {
  receipt: "receipt_email_sent_at",
  payment_not_confirmed: "refund_notice_email_sent_at",
};

export type PaymentEmailOutcome =
  | "sent"
  | "skipped_not_configured"
  | "skipped_no_payment"
  | "skipped_status"
  | "skipped_already_sent"
  | "skipped_no_recipient"
  | "failed";

export async function sendPaymentEmailOnce(
  admin: AdminClient,
  reference: string,
  cfg: EmailConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PaymentEmailOutcome> {
  if (!isEmailConfigured(cfg)) return "skipped_not_configured";

  const { data: payment, error } = await admin
    .from("payments")
    .select("id, status, payment_type, reference, amount, currency, paid_at, user_id, hangout_id, metadata")
    .eq("reference", reference)
    .maybeSingle();

  if (error || !payment) return "skipped_no_payment";

  const kind: PaymentEmailKind | null =
    payment.status === "successful" ? "receipt" :
    payment.status === "requires_refund" ? "payment_not_confirmed" :
    null;
  if (!kind) return "skipped_status";

  let to: string | undefined = payment.metadata?.user_email;
  if (!isValidEmail(to)) {
    const { data: u } = await admin.auth.admin.getUserById(payment.user_id);
    to = u?.user?.email;
  }
  if (!isValidEmail(to)) return "skipped_no_recipient";

  const column = COLUMN[kind];

  // Claim: only one caller gets the row back.
  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({ [column]: new Date().toISOString() })
    .eq("id", payment.id)
    .is(column, null)
    .select("id");
  if (claimError) {
    console.error("payment email claim failed:", claimError.message);
    return "failed";
  }
  if (!claimed || claimed.length === 0) return "skipped_already_sent";

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
    },
    cfg,
  );

  const result = await sendEmail(
    cfg,
    { to, ...message, idempotencyKey: `leenkit-payment-${kind}-${payment.id}` },
    fetchImpl,
  );

  if (result.sent) {
    await admin.from("payments").update({ email_last_error: null }).eq("id", payment.id);
    return "sent";
  }

  // Release the claim so a later webhook retry or verify call can try again.
  const reason = "error" in result ? result.error : result.skipped;
  await admin
    .from("payments")
    .update({ [column]: null, email_last_error: String(reason).slice(0, 300) })
    .eq("id", payment.id);
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
