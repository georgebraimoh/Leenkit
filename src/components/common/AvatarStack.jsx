import React from 'react';
import { useUser } from '../../context/UserContext';
import Avatar from './Avatar';

// Small overlapping avatars. Only members of a Hangout receive attendee ids,
// so for everyone else this renders nothing and the count is shown instead.
export default function AvatarStack({ attendeeIds = [], maxVisible = 4, size = 'md' }) {
  const { getUserById } = useUser();
  if (!attendeeIds || attendeeIds.length === 0) return null;

  const attendees = attendeeIds.map(id => getUserById(id)).filter(Boolean);
  const visible = attendees.slice(0, maxVisible);
  const remaining = attendees.length - maxVisible;
  const pill = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-xs' : 'w-8 h-8 text-xs';

  return (
    <div className="flex items-center -space-x-2" aria-label={`${attendees.length} going`}>
      {visible.map((user) => (
        <Avatar
          key={user.id}
          src={user.avatar}
          name={user.name}
          size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
          className="border-2 border-white shadow-xs"
        />
      ))}
      {remaining > 0 && (
        <span className={`${pill} rounded-full border-2 border-white bg-stone-900 text-white font-medium flex items-center justify-center shadow-xs`}>
          +{remaining}
        </span>
      )}
    </div>
  );
}
