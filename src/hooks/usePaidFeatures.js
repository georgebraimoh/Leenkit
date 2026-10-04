import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Whether paid Hangouts (tickets, online sponsorships, payouts) are switched
// on: platform_settings.payments.paid_hangouts_enabled. The database and Edge
// Functions enforce the same switch; this only decides what the app shows.
// Fails closed: if the setting cannot be read, paid features stay hidden.
let cached = null;

function loadPaidFeatures() {
  if (!cached) {
    cached = supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'payments')
      .maybeSingle()
      .then(({ data, error }) => !error && data?.value?.paid_hangouts_enabled === true)
      .catch(() => false);
  }
  return cached;
}

export function usePaidFeatures() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadPaidFeatures().then((value) => {
      if (!active) return;
      setEnabled(value);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  return { paidEnabled: enabled, paidLoaded: loaded };
}

export const PAID_PAUSED_MESSAGE = 'Paid tickets and online sponsorships are not available on LEENKIT yet. Free Hangouts work as usual.';
