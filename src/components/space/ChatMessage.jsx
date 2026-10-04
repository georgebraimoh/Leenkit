import React, { useState } from 'react';
import ProfileImageViewer from '../common/ProfileImageViewer';
import Avatar from '../common/Avatar';

// Phone-chat bubble. Consecutive messages from one person form a group:
// the name shows on the first bubble, the avatar next to the last one.
export default function ChatMessage({ message, isOwnMessage, isFirstInGroup = true, isLastInGroup = true }) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="my-2 text-center" role="status">
        <span className="inline-block px-3 py-1 text-xs font-bold bg-[#FFD166] text-[#111111] rounded-lg border-2 border-ink">
          {message.text}
        </span>
      </div>
    );
  }

  const corner = isOwnMessage
    ? (isLastInGroup ? 'rounded-br-md' : '')
    : (isLastInGroup ? 'rounded-bl-md' : '');

  return (
    <>
      <div style={{ animationDuration: '0.28s' }} className={`animate-fade-up flex items-end gap-2 ${isOwnMessage ? 'justify-end' : ''} ${isFirstInGroup ? 'mt-3' : 'mt-1'}`}>
        {!isOwnMessage && (
          <div className="w-8 shrink-0">
            {isLastInGroup && (
              message.userAvatar ? (
                <button
                  type="button"
                  onClick={() => setIsViewerOpen(true)}
                  aria-label={`View ${message.userName}'s profile picture`}
                  className="rounded-full cursor-pointer"
                >
                  <Avatar src={message.userAvatar} name={message.userName} size="sm" className="w-8 h-8 border-2 border-ink" />
                </button>
              ) : (
                <Avatar src={message.userAvatar} name={message.userName} size="sm" className="w-8 h-8 border-2 border-ink" />
              )
            )}
          </div>
        )}

        <div
          className={`max-w-[78%] px-3 pt-2 pb-1.5 rounded-2xl border-2 border-ink shadow-xs ${corner} ${
            isOwnMessage ? 'bg-[#18A999] text-white' : 'bg-white text-[#111111]'
          }`}
        >
          {!isOwnMessage && isFirstInGroup && (
            <p className="text-xs font-extrabold text-[#FF6B2C] mb-0.5">{message.userName}</p>
          )}
          <p className="text-sm leading-snug whitespace-pre-line break-words">
            {message.text}
            {message.timestamp && (
              <time
                dateTime={message.createdAt}
                className={`float-right ml-2 mt-1.5 text-[10px] leading-none ${isOwnMessage ? 'text-white/80' : 'text-[#6F6F6F]'}`}
              >
                {message.timestamp}
              </time>
            )}
          </p>
        </div>
      </div>

      {message.userAvatar && (
        <ProfileImageViewer
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          src={message.userAvatar}
          alt={`${message.userName}'s profile picture`}
        />
      )}
    </>
  );
}
