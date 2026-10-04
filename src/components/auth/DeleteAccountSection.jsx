import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useUser } from '../../context/UserContext';
import { useToast } from '../common/Toast';
import { accountService } from '../../services/account/accountService';

export default function DeleteAccountSection() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await accountService.deleteAccount();
      try { await logout(); } catch { /* session is already gone */ }
      showToast('Your account has been deleted.', 'success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not delete your account.');
      setIsDeleting(false);
    }
  };

  return (
    <section className="p-6 bg-white border border-rose-200 rounded-3xl space-y-3" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading" className="text-lg font-bold font-heading text-rose-700">Delete account</h2>
      <p className="text-sm text-[#3D4948]">
        This removes your profile details, profile photo and messages, cancels Hangouts you're hosting and removes you from ones you joined.
        If you've bought or sold tickets or sponsorships, we keep the payment records, linked to an anonymised account, for accounting and disputes.
      </p>
      <Button variant="danger" size="md" onClick={() => { setIsOpen(true); setConfirmText(''); setError(''); }} className="gap-2">
        <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete my account
      </Button>

      <Modal isOpen={isOpen} onClose={() => !isDeleting && setIsOpen(false)} title="Delete your account?">
        <div className="space-y-4">
          <ul className="list-disc pl-5 text-sm text-[#3D4948] space-y-1">
            <li>Your profile details, profile photo, messages and follows are removed.</li>
            <li>Upcoming Hangouts you host are cancelled and attendees are told. Paid tickets for them are flagged for refund review.</li>
            <li>Your payout account is disconnected.</li>
            <li>This can't be undone.</li>
          </ul>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[#172121]">Type DELETE to confirm</span>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full px-4 py-3 bg-[#F7F6F2] border border-[#E8E6E1] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-rose-400"
            />
          </label>
          {error && <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="outline" size="md" fullWidth onClick={() => setIsOpen(false)} disabled={isDeleting}>Keep my account</Button>
            <Button variant="danger" size="md" fullWidth onClick={handleDelete} disabled={confirmText !== 'DELETE' || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
