import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");

  if (envOrigins && envOrigins.trim().length > 0) {
    return envOrigins
      .split(",")
      .map((origin) => origin.trim().toLowerCase())
      .filter(Boolean);
  }

  console.error("ALLOWED_ORIGINS secret is not set; falling back to the production site and localhost.");
  return [
    "https://leenkit.netlify.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ];
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (origin && allowedOrigins.includes(origin.trim().toLowerCase())) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      return new Response(JSON.stringify({ error: "reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Query user's OWN payment record only
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, status, payment_type, hangout_id, amount, currency, metadata")
      .eq("reference", reference)
      .eq("user_id", user.id)
      .single();

    if (error || !payment) {
      return new Response(JSON.stringify({ error: "Payment record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback check against Paystack REST API if payment is still pending
    if (payment.status === "pending" && paystackSecretKey) {
      const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      });
      const psData = await psRes.json();

      if (psRes.ok && psData.status && psData.data?.status === "success") {
        // Same atomic, idempotent settlement the webhook uses (S7).
        const { data: settled, error: settleError } = await supabaseAdmin.rpc("settle_payment", {
          p_reference: reference,
          p_amount_subunits: Number(psData.data.amount),
          p_currency: String(psData.data.currency || ""),
          p_paid_at: psData.data.paid_at || new Date().toISOString(),
        });

        if (settleError) {
          throw new Error(`Payment settlement failed: ${settleError.message}`);
        }

        payment.status = settled === "not_found" ? payment.status : settled;
      }
    }

    return new Response(JSON.stringify({ status: payment.status, payment }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
