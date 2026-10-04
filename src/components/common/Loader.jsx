import React from 'react';

// Brand loading indicator: three bouncing dots in brand colours.
export default function Loader({ label = 'Loading', className = '' }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="flex items-end gap-1.5 h-6" aria-hidden="true">
        <span className="loader-dot w-3 h-3 rounded-full border-2 border-ink bg-[#18A999]" />
        <span className="loader-dot w-3 h-3 rounded-full border-2 border-ink bg-[#FF6B2C]" style={{ animationDelay: '0.15s' }} />
        <span className="loader-dot w-3 h-3 rounded-full border-2 border-ink bg-[#FFD166]" style={{ animationDelay: '0.3s' }} />
      </div>
      <p className="text-xs font-bold text-[#111111]">{label}</p>
    </div>
  );
}
