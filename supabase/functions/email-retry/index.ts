// Scheduled sweeper for payment emails (receipts, payment-not-confirmed
// notices, refund confirmations). Retries emails that were missed or failed
// (provider outage, function stopped mid-send, refunds marked by an admin).
// Each payment is still emailed at most once per kind (see paymentEmails.ts).
//
// Not for browsers: requires the header `x-cron-secret` matching the
// EMAIL_RETRY_SECRET secret. If that secret is not set the function refuses
// to run. Schedule it (e.g. every 10 minutes) with Supabase Cron calling this
// URL with the header; see docs/RESEND_EMAIL_SETUP.md.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient } from "../_shared/http.ts";
import { emailConfigFromEnv, isEmailConfigured } from "../_shared/email.ts";
import { MAX_EMAIL_ATTEMPTS, sendPaymentEmailOnce } from "../_shared/paymentEmails.ts";

const LOOKBACK_DAYS = 3;
const BATCH = 100;

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("EMAIL_RETRY_SECRET") || "";
  if (secret.length < 24) {
    console.error("email-retry: EMAIL_RETRY_SECRET is not set (min 24 chars); refusing to run.");
    return new Response("Not configured", { status: 503 });
  }
  if (!timingSafeEqual(req.headers.get("x-cron-secret") || "", secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cfg = emailConfigFromEnv((k) => Deno.env.get(k));
  if (!isEmailConfigured(cfg)) {
    return Response.json({ skipped: "email_not_configured" });
  }

  const admin = adminClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("payments")
    .select("reference")
    .eq("emails_enabled", true)
    .in("status", ["successful", "requires_refund", "refunded"])
    .gte("updated_at", since)
    .lt("email_attempts", MAX_EMAIL_ATTEMPTS)
    .order("updated_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("email-retry: could not load payments:", error.message);
    return new Response("Error", { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of rows || []) {
    const outcome = await sendPaymentEmailOnce(admin, row.reference, cfg);
    counts[outcome] = (counts[outcome] || 0) + 1;
  }

  return Response.json({ checked: rows?.length || 0, outcomes: counts });
});
