import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

// Links open in a new tab so reading the documents never submits the form or
// discards what the user has typed.
const linkClass =
  'font-semibold text-[#087F73] underline underline-offset-2 hover:text-[#18A999] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]/40 rounded-sm';

export default function LegalConsentCheckbox({ checked, onChange, error, disabled = false }) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 w-4 h-4 shrink-0 rounded border-ink accent-[#18A999] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]/40 focus-visible:ring-offset-2 disabled:opacity-50"
        />
        <label htmlFor={inputId} className="text-xs text-[#3D4948] leading-relaxed cursor-pointer">
          I have read and agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Terms &amp; Conditions
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Privacy Policy
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-600 flex items-center gap-1.5 pl-7">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
