// Shared helpers for LEENKIT Edge Functions.
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins && envOrigins.trim().length > 0) {
    return envOrigins.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean);
  }
  console.error("ALLOWED_ORIGINS secret is not set; falling back to the production site and localhost.");
  return ["https://leenkit.netlify.app", "http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && getAllowedOrigins().includes(origin.trim().toLowerCase())) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function json(req: Request, payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verifies the caller's JWT. Never trust a user id sent in the body.
export async function requireUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function paystack(path: string, init: RequestInit = {}): Promise<any> {
  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status === false) {
    throw new Error(body?.message || `Paystack request failed (${res.status})`);
  }
  return body;
}

export type FeeSettings = { percent: number; min_ngn: number; min_payment_ngn: number };

export async function getFeeSettings(admin: SupabaseClient): Promise<FeeSettings> {
  const defaults: FeeSettings = { percent: 10, min_ngn: 200, min_payment_ngn: 1000 };
  const { data } = await admin.from("platform_settings").select("value").eq("key", "platform_fee").maybeSingle();
  const v = (data?.value || {}) as Partial<FeeSettings>;
  return {
    percent: Number.isFinite(Number(v.percent)) ? Number(v.percent) : defaults.percent,
    min_ngn: Number.isFinite(Number(v.min_ngn)) ? Number(v.min_ngn) : defaults.min_ngn,
    min_payment_ngn: Number.isFinite(Number(v.min_payment_ngn)) ? Number(v.min_payment_ngn) : defaults.min_payment_ngn,
  };
}

// LEENKIT's share: percent of the amount, at least min_ngn, never more than half.
export function platformFee(amount: number, s: FeeSettings): number {
  const pct = Math.round(amount * s.percent) / 100;
  const fee = Math.max(pct, s.min_ngn);
  return Math.min(Math.round(fee * 100) / 100, Math.round(amount * 50) / 100);
}
