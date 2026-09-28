import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import FormField from '../common/FormField';
import { useToast } from '../common/Toast';
import { useUser } from '../../context/UserContext';
import { safetyService } from '../../services/safety/safetyService';
import { ShieldAlert, CheckCircle } from 'lucide-react';

const REPORT_REASONS = [
  "Suspicious behavior",
  "Harassment or offensive behavior",
  "Fake Hangout or misleading info",
  "Inappropriate content",
  "Unsafe location",
  "Scam or spam",
  "Other concern"
];

export default function ReportModal({ isOpen, onClose, targetType = 'activity', targetId, targetTitle }) {
  const { showToast } = useToast();
  const { currentUser } = useUser();

  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      safetyService.submitReport({
        targetType,
        targetId,
        targetTitle,
        reason,
        description,
        reporterId: currentUser?.id || 'guest'
      });

      setIsSubmitting(false);
      showToast("Report submitted. Our trust & safety team will review this shortly.", "success");
      onClose();
    }, 400);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Concern">
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        <div className="p-3.5 bg-[#DDF4EF]/40 border border-[#18A999]/30 rounded-2xl flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-[#18A999] shrink-0" />
          <p className="text-xs text-[#171717]">
            Reporting <strong className="font-bold">"{targetTitle || targetType}"</strong>. Reports are anonymous and handled discreetly by our safety team.
          </p>
        </div>

        <FormField label="What is the issue?" required>
          <div className="space-y-2 pt-1">
            {REPORT_REASONS.map((r, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                  reason === r
                    ? 'border-[#18A999] bg-[#DDF4EF]/50 text-[#171717]'
                    : 'border-[#E8E6E1] bg-[#F7F6F2] text-[#6F6F6F] hover:text-[#171717]'
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-[#18A999]"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Additional Details (Optional)" helpText="Provide any helpful context for our moderation team.">
          <textarea
            rows="3"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what happened..."
            className="w-full px-4 py-3 bg-[#F7F6F2] border border-[#E8E6E1] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
          />
        </FormField>

        <div className="pt-2 flex gap-3 border-t border-[#E8E6E1]">
          <Button onClick={onClose} variant="outline" size="md" className="w-1/3">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} variant="primary" size="md" className="w-2/3">
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
