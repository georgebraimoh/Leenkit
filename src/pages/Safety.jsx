import React from 'react';
import PageTransition from '../components/layout/PageTransition';
import { ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';

export default function Safety() {
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF4EF] text-[#087F73] text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#087F73]" />
            <span>Community Trust & Safety Guide</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#172121]">
            Have fun. Stay smart.
          </h1>
          <p className="text-base text-[#3D4948] leading-relaxed">
            LEENKIT helps people discover, create, join, and share real-life Hangouts. These simple recommendations can help you make thoughtful decisions when meeting people offline.
          </p>
        </div>

        {/* Emergency Notice */}
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-3xl flex items-start gap-4 text-xs text-rose-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold block text-sm">Emergency Assistance Notice</strong>
            <p className="leading-relaxed">
              LEENKIT is a social discovery platform and does not provide emergency dispatch services. <strong>If you are in immediate danger, contact your local emergency services or someone you trust immediately.</strong>
            </p>
          </div>
        </div>

        {/* 3 Core Timeline Sections */}
        <div className="space-y-8">
          {/* 1. BEFORE THE HANGOUT */}
          <div className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#DDF4EF] text-[#18A999] font-bold flex items-center justify-center text-xs">
                1
              </span>
              <h2 className="text-2xl font-bold font-heading text-[#172121]">
                Before the hangout
              </h2>
            </div>

            <ul className="space-y-3 pt-2 text-sm text-[#172121]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Check the Hangout details:</strong> Review the Hangout description, venue, and participant count.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Look at the location:</strong> Prefer public places like coffee shops, parks, beach fronts, or established venues.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Tell someone you trust:</strong> Share your location, Hangout details, and expected return time with a friend or family member.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Arrange your own transportation:</strong> Plan how you will arrive and return independently.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Protect personal information:</strong> Don't share sensitive details like your home address or financial info.</span>
              </li>
            </ul>
          </div>

          {/* 2. DURING THE HANGOUT */}
          <div className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#DDF4EF] text-[#18A999] font-bold flex items-center justify-center text-xs">
                2
              </span>
              <h2 className="text-2xl font-bold font-heading text-[#172121]">
                During the hangout
              </h2>
            </div>

            <ul className="space-y-3 pt-2 text-sm text-[#172121]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Stay aware of surroundings:</strong> Remain observant of public spaces and exit paths.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Keep your phone accessible:</strong> Ensure your mobile device is charged and reachable.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Stay in shared public areas:</strong> Avoid moving to secluded or unverified places with people you just met.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Trust your instincts:</strong> If a Hangout or person makes you feel uncomfortable, feel empowered to leave immediately.</span>
              </li>
            </ul>
          </div>

          {/* 3. AFTER THE HANGOUT */}
          <div className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#DDF4EF] text-[#18A999] font-bold flex items-center justify-center text-xs">
                3
              </span>
              <h2 className="text-2xl font-bold font-heading text-[#172121]">
                After the hangout
              </h2>
            </div>

            <ul className="space-y-3 pt-2 text-sm text-[#172121]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Confirm safety with your contact:</strong> Let your trusted contact know you returned safely.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#18A999] shrink-0 mt-1" />
                <span><strong>Report concerning behavior:</strong> If a Hangout, host, or attendee was suspicious or unsafe, use LEENKIT's report button.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center pt-6">
          <Link to="/explore">
            <Button variant="primary" size="lg" showArrow>
              Return to Explore Hangouts
            </Button>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
