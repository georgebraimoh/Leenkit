import React from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import AvatarStack from '../common/AvatarStack';
import { useUser } from '../../context/UserContext';
import { useLeenkit } from '../../context/LeenkitContext';
import Avatar from '../common/Avatar';

function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActivityCard({ notification }) {
  const navigate = useNavigate();
  const { getUserById, markNotificationRead } = useUser();
  const { getHangoutById } = useLeenkit();

  const actor = getUserById(notification.actorId);
  const hangout = getHangoutById(notification.hangoutId);

  const isUnread = !notification.isRead;
  const timeAgo = getRelativeTime(notification.createdAt);

  const actorName = actor?.name || 'A LEENKIT member';
  const actorAvatar = actor?.avatar || null;

  const hangoutTitle = hangout?.title || notification.title || 'LEENKIT Hangout';
  const attendeeIds = hangout?.attendeeIds || [];

  // Determine Type Labels & Actions
  let typeLabel = '✨ NEW ACTIVITY';
  let primaryActionText = 'View Hangout';
  let primaryActionPath = notification.hangoutId ? `/hangout/${notification.hangoutId}` : '#';

  if (notification.type === 'space_message') {
    typeLabel = '💬 NEW MESSAGE';
    primaryActionText = 'Open Hangout Space';
    primaryActionPath = notification.hangoutId ? `/hangout/${notification.hangoutId}/space` : '#';
  } else if (notification.type === 'hangout_join') {
    typeLabel = '🤝 NEW PERSON JOINED';
    primaryActionText = 'View Hangout';
    primaryActionPath = notification.hangoutId ? `/hangout/${notification.hangoutId}` : '#';
  } else if (notification.type === 'hangout_cancelled') {
    typeLabel = 'HANGOUT CANCELLED';
    primaryActionText = 'View Hangout';
  } else if (notification.type === 'vibe' || notification.type === 'vibe_hangout') {
    typeLabel = '✨ NEW VIBE';
    primaryActionText = notification.hangoutId ? 'View Hangout' : 'View Profile';
    primaryActionPath = notification.hangoutId
      ? `/hangout/${notification.hangoutId}`
      : (actor?.username ? `/profile/${actor.username}` : '#');
  }

  const messageText = notification.message || (notification.type === 'hangout_join' ? `${actorName} joined your Hangout.` : null);
  const showParticipantStack = (notification.type === 'vibe' || notification.type === 'vibe_hangout') && attendeeIds.length > 0;

  const handleCardClick = async () => {
    if (isUnread) {
      await markNotificationRead(notification.id);
    }
    if (primaryActionPath && primaryActionPath !== '#') {
      navigate(primaryActionPath);
    }
  };

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      onClick={handleCardClick}
      className={`group relative border rounded-2xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer ${
        isUnread
          ? 'bg-[#DDF4EF]/25 border-[#18A999] shadow-2xs'
          : 'bg-white border-ink hover:border-[#18A999]/60 hover:bg-[#FFF8EE]/40 shadow-2xs'
      }`}
    >
      {/* Header Row: 32-36px Avatar, Actor Name, Activity Label, Timestamp */}
      <div className="flex items-center gap-3">
        <Avatar src={actorAvatar} name={actorName} size="md" className="border-2 border-ink" />

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-[#111111] truncate">
              {actorName}
            </span>
            <span className="text-[10px] text-[#6F6F6F]">·</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#18A999]">
              {typeLabel}
            </span>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-[#18A999] shrink-0" />
            )}
          </div>

          <span className="text-[11px] font-medium text-[#6F6F6F] shrink-0">
            {timeAgo}
          </span>
        </div>
      </div>

      {/* Content Row: Hangout Title + Message / Context Preview */}
      <div className="mt-2.5 sm:pl-12 pl-0 space-y-0.5">
        <h4 className="text-xs font-bold text-[#111111] truncate leading-tight">
          {hangoutTitle}
        </h4>

        {messageText && (
          <p className="text-xs text-[#555] line-clamp-2 leading-relaxed font-sans">
            "{messageText}"
          </p>
        )}
      </div>

      {/* Footer Row: Participant Avatar Stack (Vibe activities only) + Contextual CTA */}
      <div className="mt-3 pt-2.5 border-t-2 border-ink flex items-center justify-between gap-2 sm:pl-12 pl-0">
        <div className="flex items-center gap-2 min-w-0">
          {showParticipantStack && (
            <>
              <AvatarStack attendeeIds={attendeeIds} maxVisible={3} size="xs" />
              <span className="text-[11px] font-medium text-[#6F6F6F] truncate">
                {attendeeIds.length} {attendeeIds.length === 1 ? 'person' : 'people'}
              </span>
            </>
          )}
        </div>

        <div className="shrink-0 ml-auto flex items-center gap-1 text-xs font-bold text-[#18A999] group-hover:text-[#087F73] transition-colors">
          <span>{primaryActionText}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </m.div>
  );
}
