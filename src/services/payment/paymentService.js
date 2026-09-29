import { supabase } from '../../lib/supabase';

export const paymentService = {
  async initializeTransaction({ hangoutId, paymentType, amount, currency, message, callbackUrl }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be signed in to make a payment.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initialize-paystack-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        hangout_id: hangoutId,
        payment_type: paymentType,
        amount,
        currency,
        message,
        callback_url: callbackUrl || window.location.href,
      }),
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error || 'Payment initialization failed.');
    }

    return resData; // returns { authorization_url, access_code, reference }
  },

  async verifyPayment(reference) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Session expired.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-paystack-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ reference }),
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error || 'Payment verification failed.');
    }

    return resData; // returns { status, payment }
  }
};
