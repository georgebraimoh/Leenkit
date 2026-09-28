import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Clock, Navigation, CheckCircle, ChevronRight } from 'lucide-react';
import AvatarStack from '../common/AvatarStack';
import { useUser } from '../../context/UserContext';
import { useLeenkit } from '../../context/LeenkitContext';
import { useLocationContext } from '../../context/LocationContext';

export default function HangoutCard({ hangout, featured = false }) {
  const { getUserById } = useUser();
  const { isAttending } = useLeenkit();
  const { getDistanceFromActive } = useLocationContext();

  // Host resolution
  const host = getUserById(hangout.hostId);
  const hostName = host?.name || 'LEENKIT Host';
  const hostAvatar = host?.avatar;

  // Formatted date string
  const formattedDate = hangout.date
    ? new Date(hangout.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : '';

  // Attendee calculation & state
  const attendeeCount = (hangout.attendeeIds || []).length;
  const maxCapacity = hangout.maxAttendees || 10;
  const isFull = attendeeCount >= maxCapacity;
  const isAttendingHangout = isAttending ? isAttending(hangout.id) : false;

  // Handle manual raw location vs object format cleanly
  const locationText =
    typeof hangout.location === 'object'
      ? (hangout.location.placeName || hangout.location.address || hangout.city || 'Location TBD')
      : (hangout.location || hangout.address || 'Location TBD');

  // Optional distance calculation
  const distanceKm = getDistanceFromActive
    ? getDistanceFromActive(
        typeof hangout.location === 'object' ? hangout.location.latitude : null,
        typeof hangout.location === 'object' ? hangout.location.longitude : null
      )
    : null;

  return (
    <Link
      to={`/hangout/${hangout.id}`}
      className={`block h-full group focus:outline-none ${
        featured ? 'md:col-span-2' : ''
      }`}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.985 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`h-full bg-white border border-[#DDE3E0] group-hover:border-[#18A999] rounded-3xl overflow-hidden shadow-xs group-hover:shadow-md transition-all flex flex-col justify-between ${
          featured ? 'md:grid md:grid-cols-2 md:items-stretch' : ''
        }`}
      >
        {/* Cover Image Container */}
        <div className={`relative overflow-hidden bg-[#EEF1EF] ${featured ? 'h-56 md:h-full' : 'h-48 sm:h-52'}`}>
          <img
            src={hangout.image || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80'}
            alt={hangout.title || 'Hangout Cover'}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Category Pill & Capacity */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[#172121]/90 backdrop-blur-xs text-white rounded-full shadow-xs">
              {hangout.category}
            </span>
            {isFull && (
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[#18A999] text-white rounded-full shadow-xs">
                Full
              </span>
            )}
          </div>

          {/* Distance Badge if available */}
          {distanceKm !== null && (
            <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-xs text-[#172121] text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs border border-[#DDE3E0]">
              <Navigation className="w-3 h-3 text-[#18A999] fill-[#18A999]" />
              <span>{distanceKm} km away</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
          <div className="space-y-2.5">
            {/* Host Profile Info */}
            <div className="flex items-center gap-2 text-xs font-medium text-[#3D4948]">
              <img
                src={hostAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={hostName}
                className="w-5 h-5 rounded-full object-cover border border-[#DDE3E0] shrink-0"
              />
              <span className="truncate">
                Hosted by <strong className="text-[#172121] font-semibold">{hostName}</strong>
              </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold font-heading text-[#172121] group-hover:text-[#18A999] transition-colors line-clamp-2 leading-snug">
              {hangout.title}
            </h3>

            {/* Location (Raw Manual Text) */}
            <div className="flex items-center gap-1.5 text-xs text-[#3D4948]">
              <MapPin className="w-3.5 h-3.5 text-[#18A999] shrink-0" />
              <span className="truncate">{locationText}</span>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#3D4948]">
              <Calendar className="w-3.5 h-3.5 text-[#18A999] shrink-0" />
              <span>{formattedDate}{hangout.time ? ` · ${hangout.time}` : ''}</span>
            </div>
          </div>

          {/* Footer Bar: Roster + Join Action Button */}
          <div className="pt-3 border-t border-[#DDE3E0] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AvatarStack attendeeIds={hangout.attendeeIds || []} maxVisible={3} size="sm" />
              <span className="text-xs text-[#3D4948] font-medium truncate">
                <strong className="text-[#172121] font-bold">{attendeeCount}</strong> going
              </span>
            </div>

            {/* Visual CTA Button State */}
            <div className="shrink-0">
              {isAttendingHangout ? (
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Joined</span>
                </span>
              ) : isFull ? (
                <span className="px-3 py-1.5 bg-[#EEF1EF] text-[#3D4948] border border-[#DDE3E0] text-xs font-bold rounded-xl">
                  Full
                </span>
              ) : (
                <span className="px-3.5 py-1.5 bg-[#18A999] group-hover:bg-[#087F73] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1">
                  <span>Join Hangout</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
