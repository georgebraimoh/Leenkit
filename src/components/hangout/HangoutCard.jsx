import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, CheckCircle, ChevronRight } from 'lucide-react';
import AvatarStack from '../common/AvatarStack';
import Avatar from '../common/Avatar';
import { useUser } from '../../context/UserContext';
import { useLeenkit } from '../../context/LeenkitContext';
import { formatEventDate, formatEventTime, formatMoney, closedReason } from '../../utils/format';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=640&q=70';
const pill = 'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-lg border-2 border-ink';

export default function HangoutCard({ hangout, featured = false }) {
  const { getUserById } = useUser();
  const { isAttending } = useLeenkit();

  const host = getUserById(hangout.hostId);
  const hostName = host?.name || 'LEENKIT Host';

  const formattedDate = hangout.date
    ? formatEventDate(hangout.date, { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  const attendeeCount = hangout.attendeeCount ?? (hangout.attendeeIds || []).length;
  const closed = closedReason(hangout);
  const isFull = attendeeCount >= (hangout.maxAttendees || 10);
  const isAttendingHangout = isAttending ? isAttending(hangout.id) : false;

  const locationText =
    typeof hangout.location === 'object'
      ? (hangout.location.placeName || hangout.location.address || hangout.city || 'Location TBD')
      : (hangout.location || hangout.address || 'Location TBD');

  const formattedPrice = hangout.isPaid ? formatMoney(hangout.price, hangout.currency) : 'Free';

  return (
    <Link
      to={`/hangout/${hangout.id}`}
      className={`editorial-card block h-full overflow-hidden focus:outline-none ${featured ? 'md:col-span-2' : ''}`}
    >
      <div className={`h-full flex flex-col ${featured ? 'md:grid md:grid-cols-2' : ''}`}>
        <div className={`relative bg-[#FFF8EE] border-b-2 border-ink ${featured ? 'h-56 md:h-full md:border-b-0 md:border-r-2' : 'h-44'}`}>
          <img
            src={hangout.image || DEFAULT_COVER}
            alt=""
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover ${closed ? 'grayscale' : ''}`}
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <span className={`${pill} bg-white text-[#111111]`}>{hangout.category || 'Hangout'}</span>
            <span className={`${pill} ${hangout.isPaid ? 'bg-[#FFD166] text-[#111111]' : 'bg-[#18A999] text-white'}`}>{formattedPrice}</span>
            {closed && <span className={`${pill} bg-[#111111] text-white`}>{closed}</span>}
            {!closed && isFull && <span className={`${pill} bg-[#FF6B2C] text-white`}>Full</span>}
          </div>
        </div>

        <div className="p-4 flex flex-col justify-between flex-1 gap-4">
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold font-heading text-[#111111] line-clamp-2 leading-snug">
              {hangout.title}
            </h3>
            <p className="flex items-center gap-1.5 text-xs font-medium text-[#3D4948]">
              <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{formattedDate}{hangout.time ? ` · ${formatEventTime(hangout.time)}` : ''}</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-[#3D4948]">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{locationText}</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-[#3D4948]">
              <Avatar src={host?.avatar} name={hostName} size="xs" />
              <span className="truncate">by <strong className="text-[#111111]">{hostName}</strong></span>
            </p>
          </div>

          <div className="pt-3 border-t-2 border-ink flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AvatarStack attendeeIds={hangout.attendeeIds || []} maxVisible={3} size="sm" />
              <span className="text-xs text-[#3D4948] truncate">
                <strong className="text-[#111111]">{attendeeCount}</strong> going
              </span>
            </div>

            {isAttendingHangout ? (
              <span className="px-3 py-1.5 bg-[#DDF4EF] text-[#111111] border-2 border-ink text-xs font-bold rounded-lg flex items-center gap-1 shrink-0">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Joined
              </span>
            ) : closed || isFull ? (
              <span className="px-3 py-1.5 bg-[#FFF8EE] text-[#3D4948] border-2 border-ink text-xs font-bold rounded-lg shrink-0">
                {closed || 'Full'}
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-[#FF6B2C] text-white border-2 border-ink text-xs font-bold rounded-lg flex items-center gap-0.5 shrink-0">
                {hangout.isPaid ? 'Get ticket' : 'Join'}
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
