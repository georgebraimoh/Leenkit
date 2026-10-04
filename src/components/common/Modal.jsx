import React, { useEffect, useId, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog: labelled, focus-trapped, Escape to close, scrolls inside
// the viewport on small phones, and returns focus to where it came from.
export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const first = panelRef.current?.querySelector(FOCUSABLE);
      (first || panelRef.current)?.focus();
    }, 30);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs"
          />

          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 15 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
            className={`relative w-full ${maxWidth} max-h-[92vh] overflow-y-auto overscroll-contain bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-ink z-10 focus:outline-none`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              {title ? (
                <h2 id={titleId} className="text-xl font-bold font-heading text-[#111111]">{title}</h2>
              ) : <span />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2 -mr-2 -mt-1 rounded-full text-[#6F6F6F] hover:bg-[#FFF8EE] hover:text-[#111111] transition-colors pressable cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
