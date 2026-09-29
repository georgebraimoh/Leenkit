import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Fetch payment record
  const { data: payment, error: payError } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .single();

  if (payError || !payment) {
    await supabaseAdmin.from("payment_events").update({ status: "orphaned" }).eq("event_key", eventKey);
    return new Response("Payment record not found", { status: 200 });
  }

  if (payment.status === "successful") {
    await supabaseAdmin.from("payment_events").update({ status: "completed" }).eq("event_key", eventKey);
    return new Response("Payment already completed", { status: 200 });
  }

  // Verify Amount & Currency Subunits (kobo/cents)
  const expectedSubunits = Math.round(Number(payment.amount) * 100);
  if (Number(data.amount) !== expectedSubunits || data.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    console.error(`FLAGGED MISMATCH: Reference ${reference}. Expected ${expectedSubunits} ${payment.currency}, received ${data.amount} ${data.currency}`);
    
    await supabaseAdmin.from("payments").update({
      status: "flagged_mismatch",
      metadata: { ...payment.metadata, mismatch: true, received_amount: data.amount, received_currency: data.currency }
    }).eq("id", payment.id);

    await supabaseAdmin.from("payment_events").update({ status: "flagged_mismatch" }).eq("event_key", eventKey);
    return new Response("Flagged amount mismatch", { status: 200 });
  }

  try {
    if (payment.payment_type === "ticket") {
      // Atomic attendance insert
      const { error: attendError } = await supabaseAdmin.from("hangout_attendees").insert({
        hangout_id: payment.hangout_id,
        user_id: payment.user_id,
      });

      if (attendError) {
        if (attendError.message.includes("LEENKIT_CAPACITY_EXCEEDED") || attendError.code === "P0001") {
          // Capacity filled while payment was processing
          await supabaseAdmin.from("payments").update({
            status: "requires_refund",
            paid_at: data.paid_at || new Date().toISOString(),
            metadata: { ...payment.metadata, capacity_exceeded: true },
          }).eq("id", payment.id);

          await supabaseAdmin.from("payment_events").update({ status: "requires_refund" }).eq("event_key", eventKey);
          return new Response("Capacity exceeded - flagged for refund", { status: 200 });
        } else if (attendError.code !== "23505") { // Ignore unique_violation (already joined)
          throw attendError;
        }
      }

      await supabaseAdmin.from("payments").update({
        status: "successful",
        paid_at: data.paid_at || new Date().toISOString(),
      }).eq("id", payment.id);

    } else if (payment.payment_type === "sponsorship") {
      // Atomic sponsorship record creation/update with payment_id linking
      const { error: spnErr } = await supabaseAdmin.from("hangout_sponsorships").insert({
        hangout_id: payment.hangout_id,
        sponsor_id: payment.user_id,
        amount: payment.amount,
        currency: payment.currency,
        message: payment.metadata?.message || null,
        status: "paid",
        payment_id: payment.id,
      });

      if (spnErr && spnErr.code !== "23505") {
        throw spnErr;
      }

      await supabaseAdmin.from("payments").update({
        status: "successful",
        paid_at: data.paid_at || new Date().toISOString(),
      }).eq("id", payment.id);
    }

    await supabaseAdmin.from("payment_events").update({ status: "completed" }).eq("event_key", eventKey);
    return new Response("Webhook processed successfully", { status: 200 });
  } catch (err: any) {
    console.error("Webhook execution error:", err);
    await supabaseAdmin.from("payment_events").update({ status: "error" }).eq("event_key", eventKey);
    return new Response("Internal execution error", { status: 500 });
  }
});
