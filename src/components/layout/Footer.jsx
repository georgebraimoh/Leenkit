import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import leenkitIcon from '../../assets/Leenkit icon.png';

const LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/create', label: 'Host' },
  { to: '/safety', label: 'Safety' },
  { to: '/faq', label: 'FAQ' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
];

export default function Footer() {
  const location = useLocation();

  if (location.pathname.endsWith('/space')) return null;

  return (
    <footer className="bg-white border-t-2 border-ink mt-20 pb-24 md:pb-10 pt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Link to="/" className="flex items-center gap-2.5" aria-label="LEENKIT home">
            <span className="w-9 h-9 rounded-xl border-2 border-ink bg-white overflow-hidden flex items-center justify-center shrink-0">
              <img src={leenkitIcon} alt="" width="36" height="36" loading="lazy" className="w-full h-full object-cover scale-[2.2]" />
            </span>
            <span className="font-heading font-extrabold text-xl tracking-tight text-[#111111]">
              LEEN<span className="text-[#18A999]">KIT</span>
            </span>
          </Link>
          <p className="text-sm text-[#3D4948]">Find your people. Find a Hangout.</p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#111111]">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="inline-block py-1.5 hover:text-[#FF6B2C] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-[#3D4948]">© {new Date().getFullYear()} LEENKIT</p>
      </div>
    </footer>
  );
}
