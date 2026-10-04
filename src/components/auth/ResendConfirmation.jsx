import React, { useEffect, useState } from 'react';
import { authService } from '../../services/auth/authService';

const COOLDOWN_SECONDS = 60;

// "Resend confirmation email" with a client-side cooldown. Supabase also
// rate-limits resends server-side; its error is shown if that limit is hit.
export default function ResendConfirmation({ email }) {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || status === 'sending' || cooldown > 0) return;
    setStatus('sending');
    setMessage('');
    try {
      await authService.resendConfirmationEmail(email);
      setStatus('sent');
      setMessage(`If ${email} has an unconfirmed LEENKIT account, a new confirmation link is on its way.`);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Could not resend the confirmation email.');
    }
  };

  if (!email) return null;

  const disabled = status === 'sending' || cooldown > 0;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleResend}
        disabled={disabled}
        className="text-xs font-bold text-[#087F73] underline underline-offset-2 hover:text-[#18A999] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]/40 rounded-sm"
      >
        {status === 'sending'
          ? 'Sending...'
          : cooldown > 0
            ? `Resend confirmation email (${cooldown}s)`
            : 'Resend confirmation email'}
      </button>
      {message && (
        <p
          role={status === 'error' ? 'alert' : 'status'}
          className={`text-xs ${status === 'error' ? 'text-rose-600' : 'text-[#3D4948]'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
