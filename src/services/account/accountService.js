import { supabase } from '../../lib/supabase';

// Calls an Edge Function with the user's session and returns its JSON,
// throwing the function's own error message on failure.
export async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body || {})
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}

export const accountService = {
  async deleteAccount() {
    return callFunction('delete-account', { confirm: 'DELETE' });
  }
};

export const payoutService = {
  async listBanks() {
    const { banks } = await callFunction('payout-account', { action: 'banks' });
    return banks || [];
  },

  async resolveAccount(bankCode, accountNumber) {
    const { account_name } = await callFunction('payout-account', {
      action: 'resolve',
      bank_code: bankCode,
      account_number: accountNumber
    });
    return account_name;
  },

  async saveAccount(bankCode, accountNumber) {
    const { account } = await callFunction('payout-account', {
      action: 'save',
      bank_code: bankCode,
      account_number: accountNumber
    });
    return account;
  },

  async getMyAccount(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('host_payout_accounts')
      .select('bank_name, account_name, account_last4, currency, updated_at, paystack_recipient_code')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Accounts saved before held payouts (split-payment subaccounts) cannot
    // receive transfers; treat them as not set up so the host adds them again.
    if (!data || !data.paystack_recipient_code) return null;
    return {
      bankName: data.bank_name,
      accountName: data.account_name,
      accountLast4: data.account_last4,
      currency: data.currency,
      updatedAt: data.updated_at
    };
  },

  async getEarnings() {
    const { data, error } = await supabase.rpc('get_host_earnings');
    if (error) throw new Error(error.message);
    return (data || []).map(r => ({
      currency: r.currency,
      ticketsSold: Number(r.tickets_sold || 0),
      sponsorships: Number(r.sponsorships || 0),
      gross: Number(r.gross || 0),
      platformFees: Number(r.platform_fees || 0),
      hostEarnings: Number(r.host_earnings || 0),
      pendingRefunds: Number(r.pending_refunds || 0),
      paidOut: Number(r.paid_out || 0),
      toBePaid: Number(r.to_be_paid || 0)
    }));
  },

  async getFeeSettings() {
    const defaults = { percent: 10, minNgn: 200, minPaymentNgn: 1000 };
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee')
      .maybeSingle();
    if (error || !data?.value) return defaults;
    return {
      percent: Number(data.value.percent ?? defaults.percent),
      minNgn: Number(data.value.min_ngn ?? defaults.minNgn),
      minPaymentNgn: Number(data.value.min_payment_ngn ?? defaults.minPaymentNgn)
    };
  }
};

// Mirrors platformFee() in the Edge Functions.
export function estimateFee(amount, settings) {
  const value = Number(amount) || 0;
  const pct = Math.round(value * settings.percent) / 100;
  const fee = Math.min(Math.max(pct, settings.minNgn), Math.round(value * 50) / 100);
  return { fee, hostAmount: Math.max(0, Math.round((value - fee) * 100) / 100) };
}
