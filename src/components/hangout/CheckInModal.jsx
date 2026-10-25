import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import { hangoutService } from '../../services/hangout/hangoutService';
import { useToast } from '../common/Toast';
import { QrCode, CheckCircle2, AlertCircle, Scan, UserCheck } from 'lucide-react';

export default function CheckInModal({ isOpen, onClose, hangout, onAttendeeCheckedIn }) {
  const { showToast } = useToast();
  const [ticketInput, setTicketInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen || !hangout) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;

    setIsSubmitting(true);
    setError('');
    setCheckInResult(null);

    try {
      const result = await hangoutService.checkInAttendee(hangout.id, ticketInput.trim());
      setCheckInResult(result);
      if (result.already_checked_in) {
        showToast(`${result.name || 'Attendee'} was already checked in.`, 'info');
      } else {
        showToast(`${result.name || 'Attendee'} successfully checked in! 🎉`, 'success');
      }
      setTicketInput('');
      onAttendeeCheckedIn?.(result);
    } catch (err) {
      setError(err.message || 'Invalid ticket code or check-in error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCheckInResult(null);
    setError('');
    setTicketInput('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Host Attendee Check-In">
      <div className="space-y-6 pt-2">
        <div className="p-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-[#18A999]" />
            <span className="font-bold text-[#111111]">Verify Ticket at Entrance</span>
          </div>
          <span className="text-[10px] uppercase font-extrabold text-[#6F6F6F]">{hangout.title}</span>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {checkInResult && (
          <div className={`p-4 rounded-3xl border-2 space-y-3 ${
            checkInResult.already_checked_in
              ? 'bg-amber-50 border-amber-300'
              : 'bg-emerald-50 border-emerald-300'
          }`}>
            <div className="flex items-center gap-3">
              <Avatar src={checkInResult.avatar} name={checkInResult.name} size="lg" className="border-2 border-ink" />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-extrabold text-base text-[#111111] truncate">{checkInResult.name || 'Attendee'}</p>
                {checkInResult.username && <p className="text-xs text-[#6F6F6F]">@{checkInResult.username}</p>}
              </div>
              <div className="shrink-0 text-right">
                <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full inline-flex items-center gap-1 ${
                  checkInResult.already_checked_in
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {checkInResult.already_checked_in ? 'Already Verified' : 'Checked In'}
                </span>
              </div>
            </div>

            <div className="text-xs text-[#3D4948] pt-2 border-t border-ink/10 flex justify-between">
              <span>Code: <strong>{checkInResult.ticket_code}</strong></span>
              <span>Time: {new Date(checkInResult.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <Button onClick={handleReset} variant="outline" size="sm" fullWidth className="mt-2">
              Scan Next Ticket
            </Button>
          </div>
        )}

        {/* Manual Code Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111111] uppercase tracking-wider block">
              Enter 6-Character Ticket Code
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. LK-7B9K2"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                maxLength={10}
                required
                className="w-full px-4 py-3 bg-[#FFF8EE] border-2 border-ink focus:border-[#18A999] rounded-2xl text-lg font-mono font-extrabold tracking-wider text-[#111111] uppercase outline-none"
              />
            </div>
            <p className="text-[11px] text-[#6F6F6F]">
              Attendees can show their QR code or the alphanumeric code from their ticket.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} variant="outline" size="md" className="w-1/3">
              Close
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !ticketInput.trim()}
              variant="primary"
              size="md"
              className="w-2/3 gap-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Checking in...' : 'Verify Ticket'}</span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
