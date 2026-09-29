import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_CURRENCIES = ["NGN", "USD", "EUR", "GBP"];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");

  if (envOrigins && envOrigins.trim().length > 0) {
    return envOrigins
      .split(",")
      .map((origin) => origin.trim().toLowerCase())
      .filter(Boolean);
  }

  return [
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

    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user session strictly via JWT (never trust frontend user_id)
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { hangout_id, payment_type, amount, currency = "NGN", message, callback_url } = body;

    if (!hangout_id || !payment_type) {
      return new Response(JSON.stringify({ error: "hangout_id and payment_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch authoritative Hangout record from DB (ignore ticket prices sent by browser)
    const { data: hangout, error: hangoutError } = await supabaseAdmin
      .from("hangouts")
      .select("id, title, is_paid, price, currency, max_attendees")
      .eq("id", hangout_id)
      .single();

    if (hangoutError || !hangout) {
      return new Response(JSON.stringify({ error: "Hangout not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let finalAmount: number;
    let finalCurrency: string;

    if (payment_type === "ticket") {
      if (!hangout.is_paid || !hangout.price || hangout.price <= 0) {
        return new Response(JSON.stringify({ error: "This Hangout is free and does not require ticket payment." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check capacity
      const { count: attendeeCount } = await supabaseAdmin
        .from("hangout_attendees")
        .select("id", { count: "exact", head: true })
        .eq("hangout_id", hangout_id);

      if ((attendeeCount || 0) >= hangout.max_attendees) {
        return new Response(JSON.stringify({ error: "This Hangout is at full capacity." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      finalAmount = Number(hangout.price);
      finalCurrency = (hangout.currency || "NGN").toUpperCase();
    } else if (payment_type === "sponsorship") {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid sponsorship amount." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check user membership before sponsoring
      const { data: isMember } = await supabaseAdmin.rpc("is_hangout_member", {
        _hangout_id: hangout_id,
        _user_id: user.id,
      });

      if (!isMember) {
        return new Response(JSON.stringify({ error: "You must join this Hangout before sponsoring." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      finalAmount = parsedAmount;
      finalCurrency = String(currency).toUpperCase();
    } else {
      return new Response(JSON.stringify({ error: "Invalid payment_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_CURRENCIES.includes(finalCurrency)) {
      return new Response(JSON.stringify({ error: "Unsupported currency" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subunit calculation (kobo / cents)
    const amountInSubunits = Math.round(finalAmount * 100);
    const reference = `LK_${payment_type === "ticket" ? "TKT" : "SPN"}_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;

    // Create pending payment record
    const { error: insertPayError } = await supabaseAdmin.from("payments").insert({
      user_id: user.id,
      hangout_id,
      payment_type,
      reference,
      amount: finalAmount,
      currency: finalCurrency,
      status: "pending",
      metadata: {
        message: message ? String(message).substring(0, 200) : null,
        user_email: user.email,
        hangout_title: hangout.title,
      },
    });

    if (insertPayError) {
      throw new Error(`Failed to create payment record: ${insertPayError.message}`);
    }

    let sanitizedCallbackUrl: string | undefined = undefined;
    if (callback_url) {
      try {
        const parsed = new URL(callback_url);
        if (!getAllowedOrigins().includes(parsed.origin.toLowerCase())) {
          return new Response(JSON.stringify({ error: "Invalid callback_url origin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        sanitizedCallbackUrl = parsed.toString();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid callback_url origin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const paystackPayload: Record<string, any> = {
      email: user.email,
      amount: amountInSubunits,
      currency: finalCurrency,
      reference,
      metadata: {
        user_id: user.id,
        hangout_id,
        payment_type,
      },
    };

    if (sanitizedCallbackUrl) {
      paystackPayload.callback_url = sanitizedCallbackUrl;
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok || !paystackData.status) {
      await supabaseAdmin.from("payments").update({
        status: "failed",
        metadata: { failure_reason: paystackData.message || "Paystack initialization rejected" },
      }).eq("reference", reference);

      return new Response(JSON.stringify({ error: paystackData.message || "Paystack initialization failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("payments")
      .update({ paystack_access_code: paystackData.data.access_code })
      .eq("reference", reference);

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
