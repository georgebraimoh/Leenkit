import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Globe, Compass, Plus, ShieldCheck, HelpCircle, FileText, Lock } from 'lucide-react';
import leenkitIcon from '../../assets/Leenkit icon.png';

export default function Footer() {
  const location = useLocation();

  if (location.pathname.endsWith('/space')) return null;

  return (
    <footer className="bg-white border-t border-[#DDE3E0] mt-20 pb-20 md:pb-12 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-[#DDE3E0]">
          {/* Col 1: Brand & Philosophy */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-md shadow-black/10 border border-[#DDE3E0] bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src={leenkitIcon}
                  alt="LEENKIT Logo Icon"
                  className="w-full h-full object-cover scale-[2.2]"
                />
              </div>
              <span className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-[#172121]">
                LEEN<span className="text-[#18A999]">KIT</span>
              </span>
            </div>
            <p className="text-[#3D4948] text-sm leading-relaxed max-w-md">
              Find your people. Find something to do. Turning “we should do something sometime” into real-life Hangouts attached to coordinates everywhere.
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#172121] bg-[#DDF4EF] px-3 py-1.5 rounded-full border border-[#DDE3E0]">
              <Globe className="w-3.5 h-3.5 text-[#087F73]" />
              <span>Location-First Social Discovery</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-[#172121] uppercase tracking-wider">Quick Navigation</h4>
            <ul className="space-y-2 text-xs text-[#3D4948]">
              <li>
                <Link
                  to="/explore"
                  className="hover:text-[#18A999] transition-colors flex items-center gap-1.5 link-nudge"
                >
                  <Compass className="w-3.5 h-3.5 text-[#18A999]" />
                  <span>Explore Hangouts</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/create"
                  className="hover:text-[#18A999] transition-colors flex items-center gap-1.5 link-nudge"
                >
                  <Plus className="w-3.5 h-3.5 text-[#18A999]" />
                  <span>Host a Hangout</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/safety"
                  className="hover:text-[#18A999] transition-colors flex items-center gap-1.5 link-nudge"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#087F73]" />
                  <span className="font-semibold text-[#172121]">Safety & Trust Guide</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="hover:text-[#18A999] transition-colors flex items-center gap-1.5 link-nudge"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#18A999]" />
                  <span>FAQ</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="hover:text-[#18A999] transition-colors flex items-center gap-1.5 link-nudge"
                >
                  <FileText className="w-3.5 h-3.5 text-[#18A999]" />
                  <span>Terms & Conditions</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="hover:text-[#18A999] transition-colors flex items-center gap-1.5 link-nudge"
                >
                  <Lock className="w-3.5 h-3.5 text-[#18A999]" />
                  <span>Privacy Policy</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Product Manifesto */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-[#172121] uppercase tracking-wider">Manifesto</h4>
            <p className="text-xs text-[#3D4948] leading-relaxed">
              No awkward DMs. No permanent group chats. The Hangout is the social unit. Real human connections happen naturally through real-life Hangouts.
            </p>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#3D4948]">
          <p>© {new Date().getFullYear()} LEENKIT Platform.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-[#18A999] fill-[#18A999]" /> for real human connections everywhere.
          </p>
        </div>
      </div>
    </footer>
  );
}
