import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket, CheckCircle2, Copy, Check, Clock, User, ShieldCheck } from 'lucide-react';
import { useToast } from '../common/Toast';

export default function TicketModal({
  isOpen,
  onClose,
  hangout,
  ticket,
  ticketCode,
  checkedInAt,
  attendeeName
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !hangout) return null;

  // Support both ticket object and standalone ticketCode/checkedInAt props,
  // plus fallback code if database column is pending migration
  const effectiveCode = (
    ticket?.ticketCode ||
    ticketCode ||
    `LK-${(hangout.id || 'EVT').replace(/-/g, '').slice(0, 4).toUpperCase()}-${(attendeeName || 'PASS').slice(0, 4).toUpperCase()}`
  ).trim();

  const isCheckedIn = Boolean(ticket?.checkedInAt || checkedInAt);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(effectiveCode);
      setCopied(true);
      showToast('Ticket code copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const qrPayload = JSON.stringify({
    hangoutId: hangout.id,
    ticketCode: effectiveCode
  });


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Entry Ticket">
      <div className="space-y-6 pt-2 text-center">
        {/* Ticket Card */}
        <div className="bg-[#FFF8EE] border-2 border-ink rounded-3xl p-6 shadow-md relative overflow-hidden space-y-5">
          <div className="flex items-center justify-between border-b-2 border-ink/10 pb-3 text-left">
            <div>
              <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-[#DDF4EF] text-[#087F73] rounded-full border border-ink/20 inline-block mb-1">
                {hangout.category || 'Hangout'} Ticket
              </span>
              <h3 className="font-heading font-extrabold text-base text-[#111111] line-clamp-1">{hangout.title}</h3>
            </div>
            <Ticket className="w-6 h-6 text-[#18A999] shrink-0" />
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-4 rounded-2xl border-2 border-ink inline-block mx-auto shadow-sm">
            <QRCodeSVG
              value={qrPayload}
              size={180}
              level="H"
              includeMargin={false}
              className="mx-auto"
            />
          </div>

          {/* Ticket ID Box */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[#6F6F6F] uppercase tracking-wider">Ticket Code</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xl font-extrabold text-[#111111] tracking-wider px-3 py-1 bg-white border border-ink rounded-xl">
                {effectiveCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2 bg-white hover:bg-[#EEF1EF] border border-ink rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Copy code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#111111]" />}
              </button>
            </div>
          </div>

          {/* Check-in Status Banner */}
          <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border ${
            isCheckedIn
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-[#DDF4EF]/60 border-[#18A999]/30 text-[#087F73]'
          }`}>
            {isCheckedIn ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Checked In on {new Date(ticket?.checkedInAt || checkedInAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-[#18A999] shrink-0" />
                <span>Present this QR or code to host at the entrance</span>
              </>
            )}
          </div>

          <div className="text-[11px] text-[#6F6F6F] flex items-center justify-between pt-2 border-t border-ink/10">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> {attendeeName || 'Ticket Holder'}
            </span>
            <span className="flex items-center gap-1 font-semibold text-[#18A999]">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Pass
            </span>
          </div>
        </div>

        <Button onClick={onClose} variant="primary" size="md" fullWidth>
          Done
        </Button>
      </div>
    </Modal>
  );
}
