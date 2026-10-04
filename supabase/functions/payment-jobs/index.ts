// Scheduled job: submits queued refunds to Paystack and pays hosts their
// held money by Paystack Transfer once it is due (see _shared/paymentJobs.ts).
//
// Not for browsers: requires the header `x-cron-secret` matching CRON_SECRET.
// Refuses to run if CRON_SECRET or PAYSTACK_SECRET_KEY is missing.
// Payouts are only sent when platform_settings.payments.payouts_enabled = true;
// refunds can be paused with refunds_enabled = false.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient } from "../_shared/http.ts";
import { getPaymentSettings, paystackClient, processPayouts, processRefunds } from "../_shared/paymentJobs.ts";
import { cronSecretValid } from "../_shared/cron.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = cronSecretValid(req, (k) => Deno.env.get(k));
  if (auth !== "ok") return new Response(auth === "not_configured" ? "Not configured" : "Unauthorized", { status: auth === "not_configured" ? 503 : 401 });

  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    console.error("payment-jobs: PAYSTACK_SECRET_KEY is not set.");
    return new Response("Not configured", { status: 503 });
  }

  const admin = adminClient();
  const paystack = paystackClient(secretKey);
  const settings = await getPaymentSettings(admin);

  const result: Record<string, unknown> = {};
  try {
    result.refunds = await processRefunds(admin, paystack, { settings });
  } catch (err) {
    console.error("payment-jobs refunds failed:", (err as Error).message);
    result.refunds = { error: "failed" };
  }
  try {
    result.payouts = await processPayouts(admin, paystack, { settings });
  } catch (err) {
    console.error("payment-jobs payouts failed:", (err as Error).message);
    result.payouts = { error: "failed" };
  }

  return Response.json(result);
});
