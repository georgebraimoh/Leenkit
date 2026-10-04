import React, { useState } from 'react';
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
    <div className="bg-white border-t-2 border-ink pb-[env(safe-area-inset-bottom)] shrink-0">
      {(error || (disabled && disabledReason)) && (
        <p role={error ? 'alert' : 'status'} className={`px-4 pt-2 text-xs font-bold ${error ? 'text-rose-700' : 'text-[#3D4948]'}`}>
          {error || disabledReason}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2.5">
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          aria-label="Message"
          placeholder={disabled ? 'Messaging is closed' : 'Message'}
          className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-[#FFF8EE] border-2 border-ink rounded-full text-[#111111] placeholder-[#6F6F6F] focus:outline-none focus:bg-white disabled:opacity-50 min-h-[44px]"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="pressable w-11 h-11 rounded-full bg-[#FF6B2C] text-white border-2 border-ink shadow-xs flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label={isSending ? 'Sending' : 'Send message'}
        >
          <Send className="w-4 h-4 -ml-0.5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
