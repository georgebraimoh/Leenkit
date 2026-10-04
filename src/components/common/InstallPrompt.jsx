import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, X } from 'lucide-react';

// Offers to install LEENKIT as an app. Chrome/Edge/Android fire
// `beforeinstallprompt`; iOS Safari has no prompt, so we show the
// Share -> Add to Home Screen steps instead. Shown on Home and Explore;
// hidden once installed or dismissed (remembered on this device for 14 days).
const DISMISS_KEY = 'leenkit:install-dismissed';
const DISMISS_DAYS = 14;

function readDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

export default function InstallPrompt() {
  const location = useLocation();
  const [deferred, setDeferred] = useState(null);
  const [ios] = useState(() => !isStandalone() && isIosSafari());
  const [hidden, setHidden] = useState(() => isStandalone() || readDismissed());

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === 'accepted') setHidden(true);
    else dismiss();
  };

  // Only on the landing pages, so it never covers a page's own action bar.
  const onLandingPage = location.pathname === '/' || location.pathname === '/explore';
  if (hidden || (!deferred && !ios) || !onLandingPage) return null;

  return (
    <div className="animate-slide-up fixed inset-x-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50" style={{ animationDelay: '600ms' }} role="dialog" aria-label="Install LEENKIT">
      <div className="bg-white border-2 border-ink rounded-2xl shadow-md p-4 flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width="44" height="44" className="w-11 h-11 rounded-xl border-2 border-ink shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-base text-[#111111]">Get the LEENKIT app</p>
          {ios ? (
            <p className="text-xs text-[#3D4948] mt-0.5 flex items-center flex-wrap gap-1">
              Tap <Share className="w-3.5 h-3.5 inline" aria-label="Share" /> then <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="text-xs text-[#3D4948] mt-0.5">One tap to open your Hangouts.</p>
          )}
          {!ios && (
            <button
              type="button"
              onClick={install}
              className="pressable mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold border-2 border-ink shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Install app
            </button>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Not now" className="p-1 rounded-lg hover:bg-[#FFF8EE] cursor-pointer shrink-0">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
