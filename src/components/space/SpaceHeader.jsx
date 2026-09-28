import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Info, ExternalLink } from 'lucide-react';
import AvatarStack from '../common/AvatarStack';

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=400&q=80";

export default function SpaceHeader({ hangout }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  if (!hangout) return null;

  const formattedDate = hangout.date ? new Date(hangout.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }) : '';

  const rawLocation = typeof hangout.location === 'object'
    ? (hangout.location.placeName || hangout.location.address || '')
    : (hangout.location || '');

  const gMapsUrl = hangout.googleMapsUrl || (typeof hangout.location === 'object' ? hangout.location.googleMapsUrl : null);
  const attendeeIds = hangout.attendeeIds || [];
  const coverImgSrc = (imgError || !hangout.image) ? DEFAULT_COVER_IMAGE : hangout.image;

  return (
    <div className="bg-white border-b border-[#E8E6E1] px-4 py-3 md:px-6 sticky top-0 z-20 shadow-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Left Section: Back button & Hangout Thumbnail + Info */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/hangout/${hangout.id}`}
            className="p-2 rounded-full text-[#6F6F6F] hover:bg-[#F7F6F2] hover:text-[#171717] transition-colors cursor-pointer shrink-0"
            title="Return to Hangout Details"
            aria-label="Back to details"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Hangout Cover Thumbnail */}
          <Link to={`/hangout/${hangout.id}`} className="shrink-0 group">
            <img
              src={coverImgSrc}
              alt={hangout.title}
              onError={() => setImgError(true)}
              className="w-11 h-11 rounded-2xl object-cover border border-[#E8E6E1] group-hover:opacity-90 transition-opacity"
            />
          </Link>

          {/* Hangout Title & Context Metadata */}
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#18A999] bg-[#DDF4EF] px-2 py-0.5 rounded-full shrink-0">
                LEENKIT Space
              </span>

              {rawLocation && (
                <span className="text-xs text-[#3D4948] truncate flex items-center gap-1 max-w-[200px] sm:max-w-none">
                  <MapPin className="w-3 h-3 text-[#18A999] shrink-0" />
                  <span className="truncate">{rawLocation}</span>
                </span>
              )}

              {gMapsUrl && (
                <a
                  href={gMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:underline flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                  <span>Open in Google Maps</span>
                </a>
              )}
            </div>

            <Link
              to={`/hangout/${hangout.id}`}
              className="text-base sm:text-lg font-bold font-heading text-[#172121] hover:text-[#18A999] transition-colors leading-tight truncate block"
            >
              {hangout.title}
            </Link>

            <p className="text-xs text-[#3D4948] flex items-center gap-2 truncate">
              <span>{formattedDate} {hangout.time ? `· ${hangout.time}` : ''}</span>
              <span>•</span>
              <span className="font-semibold text-[#172121]">
                {attendeeIds.length} {attendeeIds.length === 1 ? 'person' : 'people'} in this Hangout
              </span>
            </p>
          </div>
        </div>

        {/* Right Section: Attendees Avatar Stack & Details Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block">
            <AvatarStack attendeeIds={attendeeIds} maxVisible={3} size="md" />
          </div>

          <Link
            to={`/hangout/${hangout.id}`}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#172121] bg-[#EEF1EF] hover:bg-[#DDE3E0] transition-colors flex items-center gap-1.5 pressable"
            title="View Hangout Details"
          >
            <Info className="w-4 h-4 text-[#18A999]" />
            <span className="hidden sm:inline">Details</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
