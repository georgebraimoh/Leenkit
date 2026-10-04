import { useEffect, useState } from 'react';
import { hangoutService } from '../services/hangout/hangoutService';
import { formatMoney } from '../utils/format';

// Builds the "Leave this Hangout?" message. For paid Hangouts it asks the
// server what leaving now would refund (policy: at least 24 hours before the
// start you get back what you paid minus LEENKIT's fee; later, nothing), so
// the person sees the exact amount before confirming.
export function useLeaveRefundMessage(hangout, isOpen, freeMessage) {
  // { key, preview }: the preview belongs to the Hangout id in `key`, so
  // "loading" is derived instead of being set inside the effect. The server
  // re-checks eligibility when leaving, so a preview is only informative.
  const [result, setResult] = useState({ key: null, preview: null });

  useEffect(() => {
    if (!isOpen || !hangout?.id || !hangout?.isPaid) return undefined;
    let active = true;
    const key = hangout.id;
    hangoutService
      .getLeaveRefundPreview(key)
      .then((p) => { if (active) setResult({ key, preview: p }); })
      .catch(() => { if (active) setResult({ key, preview: null }); });
    return () => { active = false; };
  }, [isOpen, hangout?.id, hangout?.isPaid]);

  if (!hangout?.isPaid) return freeMessage;
  if (result.key !== hangout.id) return 'Checking your refund…';
  const preview = result.preview;
  if (!preview || !(Number(preview.paid) > 0)) {
    return 'You will lose access to the Hangout Space.';
  }
  const hours = preview.cutoff_hours || 24;
  if (preview.eligible) {
    return `You will be refunded ${formatMoney(preview.refund_amount, preview.currency)} (what you paid minus LEENKIT's fee) to your original payment method through Paystack. It can take up to 10 business days to arrive. You will lose access to the Hangout Space.`;
  }
  return `It is less than ${hours} hours before the start, so leaving now is not refunded. You will lose access to the Hangout Space.`;
}

export function leaveToastMessage(result) {
  const amount = Number(result?.refund_amount || 0);
  return amount > 0
    ? `You left the Hangout. A refund of ${formatMoney(amount, result.currency || 'NGN')} is on its way.`
    : 'You left the Hangout.';
}
