import React from 'react';
import Modal from './Modal';
import Button from './Button';

// Accessible replacement for window.confirm().
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  error = ''
}) {
  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} title={title}>
      <div className="space-y-5">
        {message && <p className="text-sm text-[#3D4948] leading-relaxed">{message}</p>}
        {error && (
          <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-700">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button onClick={onClose} disabled={isLoading} variant="outline" size="md" fullWidth>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} variant={variant} size="md" fullWidth>
            {isLoading ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
