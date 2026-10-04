import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function SafetyReminder({ mode = 'details', className = '' }) {
  if (mode === 'host') {
    return (
      <div className={`p-4 bg-[#E8F0E8] border-2 border-ink rounded-2xl flex items-start gap-3 text-xs text-[#2D5A27] ${className}`}>
        <ShieldCheck className="w-4 h-4 text-[#2D5A27] shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold block">Safety reminder for hosts:</strong>
          <span>Pick a busy, public place, especially when people are meeting for the first time.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white border-2 border-ink rounded-2xl flex items-start justify-between gap-3 text-xs shadow-xs ${className}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-[#18A999] shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-[#111111] block">Meeting someone new?</strong>
          <span className="text-[#6F6F6F]">Consider meeting in a public place and letting someone you trust know where you'll be.</span>
        </div>
      </div>
      <Link to="/safety" className="text-[#18A999] hover:underline font-semibold shrink-0 flex items-center gap-1 link-nudge">
        <span>Guide</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
