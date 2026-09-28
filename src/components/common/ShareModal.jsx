import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useToast } from './Toast';
import { Copy, Check, Share2, Send, MapPin } from 'lucide-react';

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=400&q=80";

export default function ShareModal({ isOpen, onClose, hangout }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!hangout) return null;

  const locName = typeof hangout.location === 'object'
    ? (hangout.location.placeName || hangout.location.address || 'Location TBD')
    : (hangout.location || 'Location TBD');

  const formattedDate = hangout.date
    ? new Date(hangout.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const shareUrl = `${window.location.origin}/hangout/${hangout.id}`;

  const whatsappMessage = `Join the Hangout "${hangout.title}" on LEENKIT!\n\nLocation: ${locName}\n${formattedDate ? `Date: ${formattedDate}` : ''}${hangout.time ? ` at ${hangout.time}` : ''}\n\nJoin the Hangout: ${shareUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: `${hangout.title} · LEENKIT`,
        text: `${hangout.title} — join this Hangout on LEENKIT.`,
        url: shareUrl
      });
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        console.error('Error triggering native share:', err);
      }
    }
  };

  const coverSrc = (imgError || !hangout.image) ? DEFAULT_COVER_IMAGE : hangout.image;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Hangout">
      <div className="space-y-6 pt-2">
        {/* Hangout Summary Card */}
        <div className="p-4 bg-[#EEF1EF] rounded-2xl flex items-center gap-4 border border-[#DDE3E0]">
          <img
            src={coverSrc}
            alt={hangout.title}
            onError={() => setImgError(true)}
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-[#18A999] tracking-wider block">
              {hangout.category || 'Hangout'}
            </span>
            <h4 className="font-heading font-bold text-sm text-[#172121] truncate">
              {hangout.title}
            </h4>
            <p className="text-xs text-[#3D4948] truncate flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#18A999] shrink-0" />
              <span>{locName}</span>
            </p>
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-3">
          {/* Browser Native Web Share API Button */}
          {canNativeShare && (
            <Button
              type="button"
              onClick={handleNativeShare}
              variant="primary"
              size="md"
              fullWidth
              className="gap-2 shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Share via device apps</span>
            </Button>
          )}

          {/* WhatsApp Direct Share Button */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Send className="w-4 h-4 ml-0.5" />
            <span>Share via WhatsApp</span>
          </a>
        </div>

        {/* Share Link Copy Section */}
        <div className="pt-2 border-t border-[#DDE3E0] space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#3D4948] block">
            Hangout Share Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-xs text-[#172121] font-mono focus:outline-none select-all"
            />
            <Button
              onClick={handleCopy}
              variant={copied ? 'secondary' : 'primary'}
              size="md"
              className="shrink-0 gap-1.5 min-w-[90px]"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
