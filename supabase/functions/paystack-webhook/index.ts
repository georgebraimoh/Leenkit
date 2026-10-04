import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailConfigFromEnv } from "../_shared/email.ts";
import { runAfterResponse, sendPaymentEmailOnce } from "../_shared/paymentEmails.ts";

// Webhook HMAC-SHA512 Signature Verification
async function verifyHmacSignature(secret: string, bodyText: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"]
  );
  
  const hexBytes = new Uint8Array(signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
  return await crypto.subtle.verify("HMAC", key, hexBytes, encoder.encode(bodyText));
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  const signature = req.headers.get("x-paystack-signature");

  if (!signature || !paystackSecretKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bodyText = await req.text();
  const isValid = await verifyHmacSignature(paystackSecretKey, bodyText, signature);

  if (!isValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const eventPayload = JSON.parse(bodyText);
  const { event, data } = eventPayload;

  if (event !== "charge.success" || !data) {
    return new Response("Event ignored", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Durable Idempotency Key based on Paystack numeric transaction ID + event name
  const eventKey = `paystack_evt_${data.id}_${event}`;
  
  const { data: existingEvent } = await supabaseAdmin
    .from("payment_events")
    .select("status")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existingEvent?.status === "completed") {
    return new Response("Event already completed", { status: 200 });
  }

  if (!existingEvent) {
    await supabaseAdmin.from("payment_events").insert({
      event_key: eventKey,
      event_type: event,
      reference: data.reference,
      status: "processing",
      payload: eventPayload,
    });
  }

  const reference = data.reference;

  // S7: one atomic, idempotent settlement path (locks the payment row,
  // checks amount/currency, adds the attendee or sponsorship, records status).
  const { data: settled, error: settleError } = await supabaseAdmin.rpc("settle_payment", {
    p_reference: reference,
    p_amount_subunits: Number(data.amount),
    p_currency: String(data.currency || ""),
    p_paid_at: data.paid_at || new Date().toISOString(),
  });

  if (settleError) {
    console.error("Webhook settlement error:", settleError);
    await supabaseAdmin.from("payment_events").update({ status: "error" }).eq("event_key", eventKey);
    return new Response("Internal execution error", { status: 500 });
  }

  const eventStatus =
    settled === "not_found" ? "orphaned" :
    settled === "flagged_mismatch" ? "flagged_mismatch" :
    settled === "requires_refund" ? "requires_refund" :
    "completed";

  await supabaseAdmin.from("payment_events").update({ status: eventStatus }).eq("event_key", eventKey);

  // Receipt / payment-not-confirmed email via Resend. Sent at most once per
  // payment; failures are logged and never affect settlement or this response.
  if (settled === "successful" || settled === "requires_refund") {
    await runAfterResponse(
      sendPaymentEmailOnce(supabaseAdmin, reference, emailConfigFromEnv((k) => Deno.env.get(k))),
    );
  }

  return new Response(`Webhook processed: ${settled}`, { status: 200 });
});
