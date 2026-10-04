import React, { createContext, useContext, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success', duration = 3000) => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, duration);
  };

  const hideToast = () => setToast(null);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full px-2 pointer-events-none">
            <m.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className={`p-4 rounded-2xl shadow-2xl border flex items-center justify-between pointer-events-auto backdrop-blur-md ${
                toast.type === 'success'
                  ? 'bg-stone-900/95 text-white border-stone-800'
                  : toast.type === 'error'
                  ? 'bg-rose-900/95 text-white border-rose-800'
                  : 'bg-white/95 text-[#111111] border-ink'
              }`}
            >
              <div className="flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-[#18A999]" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-500" />}
                <p className="text-xs font-semibold">{toast.message}</p>
              </div>

              <button
                onClick={hideToast}
                className="p-1 rounded-full text-stone-400 hover:text-white transition-colors ml-2 cursor-pointer pressable"
              >
                <X className="w-4 h-4" />
              </button>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
