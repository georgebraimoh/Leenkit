import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ProfileImageViewer from '../common/ProfileImageViewer';
import Avatar from '../common/Avatar';

export default function ChatMessage({ message, isOwnMessage }) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="my-3 text-center" role="status">
        <span className="inline-block px-3.5 py-1 text-xs font-medium bg-[#E8F0E8] text-[#2D5A27] rounded-full border border-[#D5E4D5] shadow-xs">
          {message.text}
        </span>
      </div>
    );
  }

  const avatar = <Avatar src={message.userAvatar} name={message.userName} size="md" className="border border-[#E8E6E1] shadow-xs" />;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className={`flex items-start gap-2.5 my-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
      >
        {message.userAvatar ? (
          <button
            type="button"
            onClick={() => setIsViewerOpen(true)}
            aria-label={`View ${message.userName}'s profile picture`}
            className="rounded-full shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]"
          >
            {avatar}
          </button>
        ) : avatar}

        <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] space-y-1 ${isOwnMessage ? 'items-end text-right' : ''}`}>
          <div className={`flex items-center gap-2 px-1 ${isOwnMessage ? 'justify-end' : ''}`}>
            <span className="text-xs font-bold text-[#171717]">{isOwnMessage ? 'You' : message.userName}</span>
            {message.timestamp && (
              <time dateTime={message.createdAt} className="text-xs text-[#6F6F6F]">{message.timestamp}</time>
            )}
          </div>

          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line break-words ${
              isOwnMessage
                ? 'bg-[#18A999] text-white rounded-tr-xs shadow-xs text-left'
                : 'bg-white text-[#171717] border border-[#E8E6E1] rounded-tl-xs shadow-xs text-left'
            }`}
          >
            {message.text}
          </div>
        </div>
      </motion.div>

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
