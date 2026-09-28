import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled = false }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
  };

  const isCanSend = text.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center gap-2 p-3 bg-white border-t border-[#E8E6E1] shadow-lg"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Say something to the hangout..."
        className="w-full px-5 py-3 text-sm bg-[#F7F6F2] border border-transparent rounded-full text-[#171717] placeholder-[#6F6F6F] focus:outline-none focus:bg-white focus:border-[#18A999]/40 transition-all disabled:opacity-50 min-h-[44px]"
      />
      <motion.button
        type="submit"
        disabled={!isCanSend}
        whileHover={isCanSend ? { scale: 1.05 } : {}}
        whileTap={isCanSend ? { scale: 0.92 } : {}}
        className="w-11 h-11 rounded-full bg-[#18A999] hover:bg-[#087F73] text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs group min-h-[44px] min-w-[44px]"
        aria-label="Send message"
      >
        <Send className="w-4 h-4 ml-0.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </motion.button>
    </form>
  );
}
