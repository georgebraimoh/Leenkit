import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import { MapPin, Users, UserCheck, Smartphone, Compass, ShieldAlert, ChevronDown, ShieldCheck, ArrowRight } from 'lucide-react';

const SAFETY_TIPS = [
  {
    id: 'public',
    icon: MapPin,
    title: 'Meet in public',
    summary: 'Choose public venues with other people around for your first meetup.',
    details: 'For your first hangout with someone new, choose a public coffee shop, park, beach, or venue with other people around.'
  },
  {
    id: 'tell',
    icon: Users,
    title: 'Tell someone',
    summary: 'Let a friend or family member know your plans.',
    details: 'Share where you are going, what Hangout you are joining, and who you are meeting with someone you trust.'
  },
  {
    id: 'go-together',
    icon: UserCheck,
    title: 'Go with someone when possible',
    summary: 'Bring a friend along to casual group activities.',
    details: 'Especially when meeting people you don’t know well, consider bringing a friend or attending with someone you trust.'
  },
  {
    id: 'phone',
    icon: Smartphone,
    title: 'Keep your phone available',
    summary: 'Keep your phone charged and easily accessible.',
    details: 'Ensure your phone is charged and that you have a reliable way to contact someone or arrange transport if needed.'
  },
  {
    id: 'instincts',
    icon: Compass,
    title: 'Trust your instincts',
    summary: 'Leave anytime if a Hangout doesn’t feel right.',
    details: 'If something feels off or uncomfortable, you don’t have to stay. Feel empowered to leave and head somewhere safe.'
  },
  {
    id: 'privacy',
    icon: ShieldAlert,
    title: 'Keep personal info private',
    summary: 'Protect sensitive details such as home address or financial info.',
    details: 'Avoid sharing home addresses, financial details, passwords, or private documents with people you meet online.'
  }
];

export default function SafetySection() {
  const [expandedId, setExpandedId] = useState('public');

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="editorial-surface p-8 md:p-12 bg-white border border-[#DDE3E0] rounded-3xl shadow-xs space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#DDE3E0]">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DDF4EF] text-[#087F73] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Trust & Safety</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-[#172121]">
              Meet people. Have fun. Stay safe.
            </h2>
            <p className="text-sm md:text-base text-[#3D4948] leading-relaxed">
              LEENKIT is about getting out, trying new things and meeting people through real-life Hangouts. A little awareness goes a long way.
            </p>
          </div>

          <Link to="/safety" className="shrink-0">
            <Button variant="outline" size="md" className="gap-2">
              <span>Read safety guide</span>
              <ArrowRight className="w-4 h-4 text-[#18A999]" />
            </Button>
          </Link>
        </div>

        {/* 6 Tips Accordion Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SAFETY_TIPS.map((tip) => {
            const Icon = tip.icon;
            const isExpanded = expandedId === tip.id;

            return (
              <div
                key={tip.id}
                onClick={() => setExpandedId(isExpanded ? null : tip.id)}
                className={`pressable p-5 rounded-2xl border transition-all cursor-pointer ${
                  isExpanded
                    ? 'border-[#18A999] bg-[#DDF4EF]/40 shadow-sm'
                    : 'border-[#DDE3E0] bg-[#EEF1EF] hover:border-[#18A999]/30 hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-heading font-bold text-sm text-[#172121]">
                      {tip.title}
                    </h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#3D4948] transition-transform ${isExpanded ? 'rotate-180 text-[#18A999]' : ''}`} />
                </div>

                <p className="text-xs text-[#3D4948] mt-2 font-medium leading-relaxed">
                  {tip.summary}
                </p>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-[#172121] pt-3 mt-3 border-t border-[#DDE3E0] leading-relaxed">
                        {tip.details}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
