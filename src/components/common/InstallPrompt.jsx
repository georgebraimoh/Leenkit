import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, SquarePlus, Ellipsis, Compass, Copy, Check, X } from 'lucide-react';

// Offers to install LEENKIT as an app.
// - Chrome/Edge/Android fire `beforeinstallprompt`, so we show an Install button.
// - iPhone/iPad never allow a website to install itself: people must use
//   Share -> Add to Home Screen. That works in Safari and (iOS 16.4+) in
//   Chrome, Firefox and Edge, but not inside in-app browsers (Instagram,
//   WhatsApp, Facebook...), which must open the page in Safari first. We show
//   the right steps for each case.
// Shown on Home and Explore; hidden once installed or dismissed (remembered on
// this device for 14 days).
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

// 'safari' | 'browser' | 'in-app' on iPhone/iPad, otherwise null.
function detectIosMode(ua = window.navigator.userAgent, touchPoints = navigator.maxTouchPoints || 0) {
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && touchPoints > 1);
  if (!ios) return null;
  if (/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Messenger|Snapchat|TikTok|musical_ly|LinkedInApp|Twitter|Line\/|GSA\//i.test(ua) || !/safari/i.test(ua)) return 'in-app';
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Brave/i.test(ua)) return 'browser';
  return 'safari';
}

const STEPS = {
  safari: [
    [Share, <>Tap <strong>Share</strong> in the toolbar (on newer iPhones, tap <strong>⋯</strong> first).</>],
    [SquarePlus, <>Scroll down and tap <strong>Add to Home Screen</strong>.</>],
    [Check, <>Tap <strong>Add</strong>. LEENKIT is now on your home screen.</>],
  ],
  browser: [
    [Share, <>Tap <strong>Share</strong> in the address bar or the <strong>⋯</strong> menu.</>],
    [SquarePlus, <>Tap <strong>Add to Home Screen</strong>.</>],
    [Check, <>Tap <strong>Add</strong>. LEENKIT is now on your home screen.</>],
  ],
  'in-app': [
    [Ellipsis, <>This app’s browser can’t install LEENKIT. Tap <strong>⋯</strong> or the menu.</>],
    [Compass, <>Choose <strong>Open in Safari</strong> (or Open in browser).</>],
    [Share, <>In Safari, tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.</>],
  ],
};

export default function InstallPrompt() {
  const location = useLocation();
  const [deferred, setDeferred] = useState(null);
  const [iosMode] = useState(() => (isStandalone() ? null : detectIosMode()));
  const [hidden, setHidden] = useState(() => isStandalone() || readDismissed());
  const [copied, setCopied] = useState(false);

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch { /* clipboard blocked; the steps still apply */ }
  };

  // Only on the landing pages, so it never covers a page's own action bar.
  const onLandingPage = location.pathname === '/' || location.pathname === '/explore';
  if (hidden || (!deferred && !iosMode) || !onLandingPage) return null;

  const steps = iosMode ? STEPS[iosMode] : null;

  return (
    <div className="animate-slide-up fixed inset-x-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50" style={{ animationDelay: '600ms' }} role="dialog" aria-label="Install LEENKIT">
      <div className="bg-white border-2 border-ink rounded-2xl shadow-md p-4">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" width="44" height="44" className="w-11 h-11 rounded-xl border-2 border-ink shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-extrabold text-base text-[#111111]">Get the LEENKIT app</p>
            <p className="text-xs text-[#3D4948] mt-0.5">
              {steps ? 'Add it to your home screen in 3 taps. Free, no app store.' : 'One tap to open your Hangouts.'}
            </p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Not now" className="p-1 rounded-lg hover:bg-[#FFF8EE] cursor-pointer shrink-0">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {steps ? (
          <>
            <ol className="mt-3 space-y-2">
              {steps.map(([Icon, label], i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs text-[#111111]">
                  <span className="w-7 h-7 rounded-lg bg-[#FFF8EE] border-2 border-ink flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <span><span className="sr-only">Step {i + 1}: </span>{label}</span>
                </li>
              ))}
            </ol>
            {iosMode === 'in-app' && (
              <button
                type="button"
                onClick={copyLink}
                className="pressable mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#111111] text-xs font-bold border-2 border-ink shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                {copied ? 'Link copied. Paste it in Safari.' : 'Copy link for Safari'}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={install}
            className="pressable mt-3 ml-14 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold border-2 border-ink shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Install app
          </button>
        )}
      </div>
    </div>
  );
}
