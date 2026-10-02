import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';

const MAX_LENGTH = 2000;

// The text is only cleared once the server accepts the message; on failure
// it stays in the box with an error so nothing is lost.
export default function ChatInput({ onSendMessage, disabled = false, disabledReason = '' }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled || isSending) return;

    setIsSending(true);
    setError('');
    try {
      await onSendMessage(trimmed);
      setText('');
    } catch (err) {
      setError(err?.message || 'Message not sent. Tap send to try again.');
    } finally {
      setIsSending(false);
    }
  };

  const canSend = text.trim().length > 0 && !disabled && !isSending;

  return (
    <div className="bg-white border-t border-[#E8E6E1] shadow-lg pb-[env(safe-area-inset-bottom)]">
      {(error || (disabled && disabledReason)) && (
        <p role={error ? 'alert' : 'status'} className={`px-4 pt-2 text-xs font-medium ${error ? 'text-rose-700' : 'text-[#6F6F6F]'}`}>
          {error || disabledReason}
        </p>
      )}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2 p-3">
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          aria-label="Message"
          placeholder={disabled ? 'Messaging is closed' : 'Say something to the Hangout...'}
          className="w-full px-5 py-3 text-sm bg-[#F7F6F2] border border-transparent rounded-full text-[#171717] placeholder-[#6F6F6F] focus:outline-none focus:bg-white focus:border-[#18A999]/40 transition-all disabled:opacity-50 min-h-[44px]"
        />
        <motion.button
          type="submit"
          disabled={!canSend}
          whileTap={canSend ? { scale: 0.92 } : {}}
          className="w-11 h-11 rounded-full bg-[#18A999] hover:bg-[#087F73] text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs min-h-[44px] min-w-[44px]"
          aria-label={isSending ? 'Sending' : 'Send message'}
        >
          <Send className="w-4 h-4 ml-0.5" aria-hidden="true" />
        </motion.button>
      </form>
    </div>
  );
}
