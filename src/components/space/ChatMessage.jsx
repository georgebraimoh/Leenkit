import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function ChatMessage({ message, isOwnMessage }) {
  const [imgError, setImgError] = useState(false);

  if (message.type === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="my-3 text-center"
      >
        <span className="inline-block px-3.5 py-1 text-xs font-medium bg-[#E8F0E8] text-[#2D5A27] rounded-full border border-[#D5E4D5] shadow-xs">
          {message.text}
        </span>
      </motion.div>
    );
  }

  const initials = message.userName ? message.userName.substring(0, 2).toUpperCase() : 'QU';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex items-start gap-2.5 my-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar or Initials Badge */}
      {message.userAvatar && !imgError ? (
        <img
          src={message.userAvatar}
          alt={message.userName}
          onError={() => setImgError(true)}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0 border border-[#E8E6E1] shadow-xs"
        />
      ) : (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#18A999] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          {initials}
        </div>
      )}

      {/* Message Content Bubble */}
      <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] space-y-1 ${isOwnMessage ? 'items-end text-right' : ''}`}>
        <div className={`flex items-center gap-2 px-1 ${isOwnMessage ? 'justify-end' : ''}`}>
          <span className="text-xs font-bold text-[#171717]">{message.userName}</span>
          {message.timestamp && (
            <span className="text-[10px] text-[#6F6F6F]">{message.timestamp}</span>
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
  );
}
