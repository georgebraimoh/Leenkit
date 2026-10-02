// Host payout account: list banks, verify an account number, and create or
// update the host's Paystack subaccount (split payments).
//
// POST { action: "banks" }
// POST { action: "resolve", bank_code, account_number }
// POST { action: "save", bank_code, account_number }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, getFeeSettings, json, paystack, requireUser } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const admin = adminClient();

    if (action === "banks") {
      const res = await paystack("/bank?country=nigeria&currency=NGN&perPage=200");
      const banks = (res.data || [])
        .filter((b: any) => b.active !== false && b.is_deleted !== true)
        .map((b: any) => ({ name: b.name, code: b.code }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      return json(req, { banks });
    }

    const bankCode = String(body.bank_code || "").trim();
    const accountNumber = String(body.account_number || "").replace(/\D/g, "");
    if (!bankCode || accountNumber.length !== 10) {
      return json(req, { error: "Enter a 10-digit NUBAN account number and choose a bank." }, 400);
    }

    // Always verify the account with Paystack; never trust a name from the browser.
    const resolved = await paystack(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    const accountName = String(resolved.data?.account_name || "").trim();
    if (!accountName) return json(req, { error: "We could not verify that account." }, 400);

    if (action === "resolve") {
      return json(req, { account_name: accountName });
    }

    if (action !== "save") return json(req, { error: "Unknown action" }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("name, suspended_at, deleted_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.suspended_at || profile.deleted_at) {
      return json(req, { error: "This account cannot receive payouts." }, 403);
    }

    const fee = await getFeeSettings(admin);
    const bankList = await paystack("/bank?country=nigeria&currency=NGN&perPage=200");
    const bankName = (bankList.data || []).find((b: any) => b.code === bankCode)?.name || bankCode;

    const { data: existing } = await admin
      .from("host_payout_accounts")
      .select("paystack_subaccount_code")
      .eq("user_id", user.id)
      .maybeSingle();

    const subaccountPayload = {
      business_name: `${profile.name || "LEENKIT host"} (LEENKIT)`.slice(0, 100),
      bank_code: bankCode,
      settlement_bank: bankCode,
      account_number: accountNumber,
      // LEENKIT's share; each transaction also sets an exact transaction_charge.
      percentage_charge: fee.percent,
      primary_contact_email: user.email,
      metadata: JSON.stringify({ leenkit_user_id: user.id }),
    };

    let subaccountCode: string;
    if (existing?.paystack_subaccount_code) {
      const res = await paystack(`/subaccount/${encodeURIComponent(existing.paystack_subaccount_code)}`, {
        method: "PUT",
        body: JSON.stringify(subaccountPayload),
      });
      subaccountCode = res.data?.subaccount_code || existing.paystack_subaccount_code;
    } else {
      const res = await paystack("/subaccount", { method: "POST", body: JSON.stringify(subaccountPayload) });
      subaccountCode = res.data?.subaccount_code;
    }
    if (!subaccountCode) throw new Error("Paystack did not return a subaccount code.");

    const row = {
      user_id: user.id,
      currency: "NGN",
      bank_code: bankCode,
      bank_name: bankName,
      account_name: accountName,
      account_last4: accountNumber.slice(-4),
      paystack_subaccount_code: subaccountCode,
      updated_at: new Date().toISOString(),
    };
    const { error: upsertError } = await admin.from("host_payout_accounts").upsert(row, { onConflict: "user_id" });
    if (upsertError) throw new Error(upsertError.message);

    return json(req, {
      account: {
        bankName,
        accountName,
        accountLast4: row.account_last4,
      },
    });
  } catch (err: any) {
    console.error("payout-account error:", err?.message || err);
    return json(req, { error: err?.message || "Could not save payout details." }, 500);
  }
});
