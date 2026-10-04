import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { ShieldCheck, MapPin, Users, Heart, AlertCircle } from 'lucide-react';
import { CURRENT_GUIDELINES_VERSION } from '../../services/auth/authService';

export default function HostingGuidelinesModal({ isOpen, onClose, onAccept, isLoading = false }) {
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAgree = async () => {
    setError('');
    try {
      await onAccept(CURRENT_GUIDELINES_VERSION);
    } catch (err) {
      setError(err.message || 'Failed to record acceptance. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="LEENKIT Hosting Guidelines">
      <div className="space-y-6 pt-1 text-left">
        {/* Intro */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#18A999] uppercase tracking-wider">
            Version {CURRENT_GUIDELINES_VERSION} · Community Host Agreement
          </p>
          <p className="text-xs text-[#3D4948] leading-relaxed">
            Hosting on LEENKIT is open to all eligible members. Bringing people together in real life is a privilege built on trust, respect, and safety.
          </p>
        </div>

        {/* Guidelines List */}
        <div className="space-y-3 bg-[#EEF1EF] p-4 rounded-2xl border-2 border-ink text-xs">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-[#DDF4EF] text-[#18A999] rounded-xl shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#111111]">1. Public & Accessible Venues</h4>
              <p className="text-[#3D4948] leading-normal">
                Host your meetup in an open, public place (coffee shops, parks, public sports grounds, venues). Never host first-time meetups in private residential spaces.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t-2 border-ink">
            <div className="p-1.5 bg-[#DDF4EF] text-[#18A999] rounded-xl shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#111111]">2. Safety & Respect First</h4>
              <p className="text-[#3D4948] leading-normal">
                Treat all attendees with kindness and dignity. LEENKIT has zero tolerance for harassment, discrimination, or deceptive event details.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t-2 border-ink">
            <div className="p-1.5 bg-[#DDF4EF] text-[#18A999] rounded-xl shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#111111]">3. Clear Details & Communication</h4>
              <p className="text-[#3D4948] leading-normal">
                Set accurate date, time, and attendee capacity limits. Post updates in your Hangout Space if plans change so attendees stay informed.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t-2 border-ink">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleAgree}
            disabled={isLoading}
            className="w-full sm:w-auto gap-2"
          >
            <Heart className="w-4 h-4 fill-current" />
            <span>{isLoading ? 'Saving...' : 'I Agree & Accept Guidelines'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
