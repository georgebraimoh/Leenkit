import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck, AlertCircle } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import ResendConfirmation from '../components/auth/ResendConfirmation';
import { useUser } from '../context/UserContext';

const SESSION_WAIT_MS = 10000;

// Only same-site paths: blocks open redirects such as //evil.example.
function safeNextPath(raw) {
  if (!raw || typeof raw !== 'string') return '/explore';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/explore';
  return raw;
}

// Supabase reports link problems in the query string or the URL hash.
function readAuthError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = query.get('error_code') || hash.get('error_code') || query.get('error') || hash.get('error');
  const description = query.get('error_description') || hash.get('error_description');
  if (!code && !description) return null;
  return { code: code || '', description: (description || '').replace(/\+/g, ' ') };
}

// Landing page for the email confirmation link (see emailRedirectTo in
// authService). Supabase's client exchanges the link for a session on load;
// this page waits for it, then continues to `next`.
export default function AuthCallback() {
  const navigate = useNavigate();
  const { currentUser, isAuthLoading } = useUser();
  const [timedOut, setTimedOut] = useState(false);
  const [email, setEmail] = useState('');

  const linkError = useMemo(() => readAuthError(), []);
  const next = useMemo(() => safeNextPath(new URLSearchParams(window.location.search).get('next')), []);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Confirming your email | LEENKIT';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!linkError && !isAuthLoading && currentUser?.id) {
      navigate(next, { replace: true });
    }
  }, [linkError, isAuthLoading, currentUser?.id, navigate, next]);

  useEffect(() => {
    if (linkError) return undefined;
    const t = setTimeout(() => setTimedOut(true), SESSION_WAIT_MS);
    return () => clearTimeout(t);
  }, [linkError]);

  const expired = linkError && /expired|otp_expired|invalid|access_denied/i.test(`${linkError.code} ${linkError.description}`);

  return (
    <PageTransition>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-[#DDE3E0] rounded-3xl p-8 shadow-xl space-y-5 text-center">
          {linkError || timedOut ? (
            <>
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold font-heading text-[#172121]">
                {expired ? 'This link has expired' : 'We could not confirm your email'}
              </h1>
              <p role="alert" className="text-sm text-[#3D4948] leading-relaxed">
                {expired
                  ? 'Confirmation links can only be used once and expire after a while. Request a new one below, or sign in if you have already confirmed your email.'
                  : linkError?.description || 'The confirmation did not complete. Try signing in, or request a new confirmation email.'}
              </p>
              <div className="text-left space-y-2">
                <label htmlFor="callback-email" className="block text-xs font-semibold text-[#172121] uppercase tracking-wider">
                  Email address
                </label>
                <input
                  id="callback-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                />
                <ResendConfirmation email={/\S+@\S+\.\S+/.test(email.trim()) ? email.trim() : ''} />
              </div>
              <Link
                to="/login"
                className="inline-block text-sm font-semibold text-[#087F73] underline underline-offset-2 hover:text-[#18A999]"
              >
                Go to sign in
              </Link>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-2xl bg-[#DDF4EF] text-[#087F73] flex items-center justify-center mx-auto">
                <MailCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold font-heading text-[#172121]">Confirming your email…</h1>
              <p role="status" className="text-sm text-[#3D4948]">
                One moment while we sign you in.
              </p>
              <div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
