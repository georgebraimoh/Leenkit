// Shared formatting helpers for dates, money and Hangout state.

const CURRENCY_SYMBOLS = { NGN: '₦', USD: '$', EUR: '€', GBP: '£' };

export function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency || '₦';
}

export function formatMoney(amount, currency = 'NGN') {
  return `${currencySymbol(currency)}${Number(amount || 0).toLocaleString()}`;
}

// 'YYYY-MM-DD' parsed as a LOCAL calendar date. `new Date('2026-10-05')` is
// UTC midnight, which shows as Oct 4 west of Greenwich.
export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatEventDate(value, options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString('en-US', options) : '';
}

// '17:00' or '17:00:00' -> '5:00 PM'
export function formatEventTime(value) {
  if (!value) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value));
  if (!m) return String(value);
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatEventDateTime(hangout, dateOptions) {
  const date = formatEventDate(hangout?.date, dateOptions);
  const time = formatEventTime(hangout?.time);
  return [date, time].filter(Boolean).join(' · ');
}

// True once the Hangout's calendar date is before today.
export function isPastHangout(hangout) {
  if (!hangout?.date) return false;
  return String(hangout.date).slice(0, 10) < todayISO();
}

export function hasStarted(hangout) {
  if (!hangout?.date) return true;
  return String(hangout.date).slice(0, 10) <= todayISO();
}

// Open for discovery and joining.
export function isOpenHangout(hangout) {
  return Boolean(hangout) && hangout.status === 'upcoming' && !isPastHangout(hangout);
}

// Label + reason when a Hangout can no longer be joined.
export function closedReason(hangout) {
  if (!hangout) return null;
  if (hangout.status === 'cancelled') return 'Cancelled';
  if (hangout.status === 'completed') return 'Ended';
  if (isPastHangout(hangout)) return 'Ended';
  return null;
}

export function sortByEventDate(list) {
  return [...list].sort((a, b) => {
    const ka = `${a.date || '9999-12-31'} ${a.time || ''}`;
    const kb = `${b.date || '9999-12-31'} ${b.time || ''}`;
    return ka.localeCompare(kb);
  });
}

// Google Calendar "add event" link. Times are the venue's local wall-clock
// time; without a stored timezone, Google uses the viewer's calendar zone.
export function googleCalendarUrl(hangout) {
  if (!hangout?.date) return null;
  const d = String(hangout.date).slice(0, 10).replace(/-/g, '');
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hangout.time || ''));
  let dates;
  if (m) {
    const start = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (x) => `${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`;
    const endDay = end.getDate() !== start.getDate()
      ? (() => {
          const nd = parseLocalDate(hangout.date);
          nd.setDate(nd.getDate() + 1);
          return `${nd.getFullYear()}${String(nd.getMonth() + 1).padStart(2, '0')}${String(nd.getDate()).padStart(2, '0')}`;
        })()
      : d;
    dates = `${d}T${fmt(start)}/${endDay}T${fmt(end)}`;
  } else {
    dates = `${d}/${d}`;
  }
  const place = hangout.location?.address || hangout.location?.placeName || '';
  const details = [
    hangout.description || '',
    hangout.googleMapsUrl ? `Map: ${hangout.googleMapsUrl}` : '',
    typeof window !== 'undefined' ? `${window.location.origin}/hangout/${hangout.id}` : ''
  ].filter(Boolean).join('\n\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: hangout.title || 'Hangout',
    dates,
    details,
    location: place
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Maps database/trigger errors to friendly copy.
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  const msg = String(err?.message || err || '');
  if (msg.includes('LEENKIT_CAPACITY_EXCEEDED') || msg.toLowerCase().includes('full capacity')) {
    return 'This Hangout is full.';
  }
  if (msg.includes('LEENKIT_HANGOUT_CLOSED')) return 'This Hangout is no longer open to join.';
  if (msg.includes('LEENKIT_HANGOUT_NOT_FOUND')) return 'This Hangout no longer exists.';
  if (msg.includes('LEENKIT_PAYOUT_SETUP_REQUIRED')) return 'Add your bank account in Payouts before selling tickets.';
  if (msg.includes('LEENKIT_PAYOUT_ALREADY_SENT')) return 'This Hangout has already been paid out, so it can no longer be cancelled. Contact LEENKIT support.';
  if (msg.includes('LEENKIT_RATE_LIMITED')) return 'You are doing that too often. Please wait a moment and try again.';
  if (msg.toLowerCase().includes('row-level security') && msg.includes('hangouts')) return 'Your account cannot host right now. Contact LEENKIT support if you think this is a mistake.';
  if (msg.toLowerCase().includes('row-level security')) return 'You do not have permission to do that.';
  if (msg.includes('payments_hangout_id_fkey')) {
    return 'This Hangout has payment records, so it cannot be deleted. Cancel it instead.';
  }
  if (msg.toLowerCase().includes('failed to fetch')) return 'Network problem. Check your connection and try again.';
  return msg || fallback;
}
