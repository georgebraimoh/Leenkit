import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function ProfileImageViewer({ isOpen, onClose, src, alt = 'Profile Picture' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!src) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          {/* Dark Translucent Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-10 max-w-4xl max-h-[85vh] flex flex-col items-center justify-center select-none"
            onClick={(e) => e.stopPropagation()} // Prevents clicking the image area from closing the modal
          >
            {/* Accessible Close Button */}
            <button
              onClick={onClose}
              aria-label="Close profile picture viewer"
              title="Close image"
              className="absolute -top-12 right-0 sm:-top-14 sm:right-0 z-20 p-2.5 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white border border-white/20 transition-all cursor-pointer shadow-lg focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Uncropped Full Image Box */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-black/60 p-2 flex items-center justify-center max-w-full max-h-[80vh]">
              <img
                src={src}
                alt={alt}
                className="w-auto h-auto max-w-full max-h-[75vh] object-contain rounded-2xl select-none"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
