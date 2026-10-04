import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Info, MapPin, ShieldAlert, LogOut } from 'lucide-react';
import { formatEventDate, formatEventTime } from '../../utils/format';

const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=160&q=70';
const menuItem = 'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#111111] hover:bg-[#FFF8EE] text-left cursor-pointer';

// Chat-app style header: back, Hangout avatar + title, and an actions menu.
export default function SpaceHeader({ hangout, onReport, onLeave }) {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!hangout) return null;

  const formattedDate = hangout.date
    ? formatEventDate(hangout.date, { weekday: 'short', month: 'short', day: 'numeric' })
    : '';
  const gMapsUrl = hangout.googleMapsUrl || (typeof hangout.location === 'object' ? hangout.location.googleMapsUrl : null);
  const attendeeCount = hangout.attendeeCount ?? (hangout.attendeeIds || []).length;
  const coverImgSrc = (imgError || !hangout.image) ? DEFAULT_COVER_IMAGE : hangout.image;

  return (
    <header className="bg-white border-b-2 border-ink px-2 py-2 flex items-center gap-2 shrink-0">
      <Link
        to={`/hangout/${hangout.id}`}
        className="p-2 rounded-xl hover:bg-[#FFF8EE] shrink-0"
        aria-label="Back to Hangout"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
      </Link>

      <Link to={`/hangout/${hangout.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
        <img
          src={coverImgSrc}
          alt=""
          width="40"
          height="40"
          onError={() => setImgError(true)}
          className="w-10 h-10 rounded-full object-cover border-2 border-ink shrink-0"
        />
        <span className="min-w-0">
          <span className="block font-heading font-extrabold text-base text-[#111111] truncate leading-tight">{hangout.title}</span>
          <span className="block text-xs text-[#3D4948] truncate">
            {attendeeCount} going · {formattedDate}{hangout.time ? `, ${formatEventTime(hangout.time)}` : ''}
          </span>
        </span>
      </Link>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Chat options"
          aria-expanded={menuOpen}
          className="p-2 rounded-xl hover:bg-[#FFF8EE] cursor-pointer"
        >
          <MoreVertical className="w-5 h-5" aria-hidden="true" />
        </button>

        {menuOpen && (
          <div role="menu" className="animate-pop-in absolute right-0 mt-1 w-52 bg-white border-2 border-ink rounded-2xl shadow-md py-1.5 z-30">
            <Link role="menuitem" to={`/hangout/${hangout.id}`} className={menuItem}>
              <Info className="w-4 h-4" aria-hidden="true" /> Hangout details
            </Link>
            {gMapsUrl && (
              <a role="menuitem" href={gMapsUrl} target="_blank" rel="noopener noreferrer" className={menuItem}>
                <MapPin className="w-4 h-4" aria-hidden="true" /> Open in Maps
              </a>
            )}
            <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); onReport?.(); }} className={menuItem}>
              <ShieldAlert className="w-4 h-4" aria-hidden="true" /> Report
            </button>
            {onLeave && (
              <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); onLeave(); }} className={`${menuItem} text-rose-700`}>
                <LogOut className="w-4 h-4" aria-hidden="true" /> Leave Hangout
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
