import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, UserCheck, Smartphone, Compass, ShieldAlert, ArrowRight } from 'lucide-react';

const SAFETY_TIPS = [
  { id: 'public', icon: MapPin, title: 'Meet in public' },
  { id: 'tell', icon: Users, title: 'Tell someone your plans' },
  { id: 'go-together', icon: UserCheck, title: 'Bring a friend' },
  { id: 'phone', icon: Smartphone, title: 'Keep your phone charged' },
  { id: 'instincts', icon: Compass, title: 'Leave if it feels off' },
  { id: 'privacy', icon: ShieldAlert, title: 'Keep personal info private' }
];

export default function SafetySection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white border-2 border-ink rounded-3xl shadow-md p-6 md:p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-[#111111]">Stay safe.</h2>
          <Link to="/safety" className="text-sm font-bold text-[#111111] hover:text-[#FF6B2C] flex items-center gap-1 link-nudge">
            <span>Safety guide</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SAFETY_TIPS.map((tip) => {
            const Icon = tip.icon;
            return (
              <li key={tip.id} className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-ink bg-[#FFF8EE]">
                <span className="w-9 h-9 rounded-xl bg-[#18A999] border-2 border-ink text-white flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="font-heading font-bold text-sm text-[#111111]">{tip.title}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
