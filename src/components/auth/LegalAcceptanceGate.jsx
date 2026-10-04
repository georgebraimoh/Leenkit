import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import LegalConsentCheckbox from './LegalConsentCheckbox';
import { useUser } from '../../context/UserContext';

// Public pages a signed-in user can still read before accepting.
const EXEMPT_PATHS = ['/terms', '/privacy', '/faq', '/safety', '/reset-password'];

// Blocks the app for signed-in users who have no stored acceptance of the
// current Terms & Privacy Policy (OAuth sign-ups, existing accounts, failed
// signup recording, or a future version change).
export default function LegalAcceptanceGate() {
  const { isAuthenticated, currentUser, legalAcceptance, acceptLegalTerms, retryLegalCheck, logout } = useUser();
  const location = useLocation();
  const titleId = useId();
  const dialogRef = useRef(null);

  const [checked, setChecked] = useState(false);
  const [checkboxError, setCheckboxError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = legalAcceptance?.status;
  const isOpen =
    isAuthenticated &&
    Boolean(currentUser?.id) &&
    legalAcceptance?.userId === currentUser.id &&
    (status === 'required' || status === 'error') &&
    !EXEMPT_PATHS.includes(location.pathname);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccept = async () => {
    setSubmitError('');
    if (!checked) {
      setCheckboxError('Please agree to the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptLegalTerms();
      setChecked(false);
    } catch (e) {
      setSubmitError(e.message || 'We could not save your acceptance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (e) {
      setSubmitError(e.message || 'Could not sign out. Please try again.');
    }
  };

  const isCheckError = status === 'error';
  const message = submitError || legalAcceptance?.error;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-ink space-y-5 focus:outline-none"
      >
        <div className="space-y-3 text-center">
          <div className="w-11 h-11 rounded-2xl bg-[#DDF4EF] text-[#087F73] flex items-center justify-center mx-auto">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-xl font-bold font-heading text-[#111111]">
            Before you continue
          </h2>
          <p className="text-sm text-[#3D4948] leading-relaxed">
            To use LEENKIT, please review and agree to our Terms &amp; Conditions and Privacy Policy.
          </p>
        </div>

        {message && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
            <span>{message}</span>
          </div>
        )}

        {isCheckError ? (
          <Button variant="primary" size="lg" fullWidth onClick={retryLegalCheck}>
            Try again
          </Button>
        ) : (
          <>
            <LegalConsentCheckbox
              checked={checked}
              onChange={(value) => {
                setChecked(value);
                if (value) setCheckboxError('');
              }}
              error={checkboxError}
              disabled={isSubmitting}
            />
            <Button variant="primary" size="lg" fullWidth onClick={handleAccept} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Agree and continue'}
            </Button>
          </>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSubmitting}
            className="text-xs font-semibold text-[#3D4948] hover:text-[#111111] underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]/40 rounded-sm disabled:opacity-50"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
