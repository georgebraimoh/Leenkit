import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, UserPlus, MessageCircle } from 'lucide-react';
import HangoutCard from '../components/hangout/HangoutCard';
import EmptyState from '../components/common/EmptyState';
import PageTransition from '../components/layout/PageTransition';
import { useLeenkit } from '../context/LeenkitContext';
import { CATEGORIES } from '../data/categories';
import SafetySection from '../components/safety/SafetySection';
import Reveal from '../components/common/Reveal';
import SquiggleBalls from '../components/common/SquiggleBalls';
import HomeFaq from '../components/faq/HomeFaq';
import { isOpenHangout, sortByEventDate } from '../utils/format';

const STEPS = [
  { icon: Search, title: 'Find', text: 'Pick a Hangout near you.', bg: 'bg-[#18A999]' },
  { icon: UserPlus, title: 'Join', text: 'Free, one tap.', bg: 'bg-[#FF6B2C]' },
  { icon: MessageCircle, title: 'Show up', text: 'Chat with the group, then meet.', bg: 'bg-[#FFD166]' },
];

const ctaPrimary = 'pressable inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#18A999] text-white text-base font-bold border-2 border-ink shadow-sm';
const ctaSecondary = 'pressable inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#111111] text-base font-bold border-2 border-ink shadow-sm';

export default function Home() {
  const { hangouts, isHangoutsLoading } = useLeenkit();
  const navigate = useNavigate();

  const highlights = sortByEventDate(hangouts.filter(isOpenHangout)).slice(0, 4);

  return (
    <PageTransition>
      <div className="space-y-16 md:space-y-20 pb-10">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="animate-fade-up text-5xl sm:text-6xl lg:text-7xl font-extrabold font-heading text-[#111111] tracking-tight leading-[1.02]">
              Find your people.
              <br />
              <span className="relative inline-block text-[#FF6B2C]">
                Find a Hangout.
                <SquiggleBalls />
              </span>
            </h1>

            <p className="animate-fade-up text-lg md:text-xl text-[#3D4948] font-medium max-w-xl mx-auto" style={{ animationDelay: '90ms' }}>
              Free, real-life meetups near you. Join in a tap. Show up.
            </p>

            <div className="animate-fade-up flex flex-wrap items-center justify-center gap-3 pt-2" style={{ animationDelay: '180ms' }}>
              <Link to="/explore" className={ctaPrimary}>
                Explore Hangouts
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link to="/create" className={ctaSecondary}>
                Host one
              </Link>
            </div>
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-12">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="animate-fade-up flex items-center gap-3 p-4 bg-white border-2 border-ink rounded-2xl shadow-sm" style={{ animationDelay: `${280 + i * 90}ms` }}>
                  <span className={`w-11 h-11 rounded-xl ${step.bg} border-2 border-ink flex items-center justify-center shrink-0 ${i === 2 ? 'text-[#111111]' : 'text-white'}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-heading font-extrabold text-lg text-[#111111] leading-tight">{step.title}</span>
                    <span className="block text-sm text-[#3D4948]">{step.text}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Coming up */}
        <Reveal as="section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6 gap-4">
            <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-[#111111]">Coming up</h2>
            <Link to="/explore" className="text-sm font-bold text-[#111111] hover:text-[#FF6B2C] flex items-center gap-1 link-nudge">
              <span>See all</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {isHangoutsLoading ? (
              [0, 1, 2, 3].map(i => (
                <div key={i} className="h-72 bg-white border-2 border-ink rounded-3xl animate-pulse" aria-hidden="true" />
              ))
            ) : highlights.length === 0 ? (
              <div className="col-span-full py-6 text-center">
                <EmptyState
                  title="No Hangouts yet"
                  description="Be the first to host one."
                  actionLabel="Host a Hangout"
                  onAction={() => navigate('/create')}
                />
              </div>
            ) : (
              highlights.map((hangout, i) => (
                <Reveal key={hangout.id} delay={i * 90} className="h-full">
                  <HangoutCard hangout={hangout} />
                </Reveal>
              ))
            )}
          </div>
        </Reveal>

        {/* Categories */}
        <Reveal as="section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-[#111111] mb-6">Pick a vibe</h2>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  to={`/explore?category=${cat.id}`}
                  className="pressable inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-ink shadow-xs text-sm font-bold text-[#111111] hover:bg-[#FFD166]"
                >
                  {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
                  <span>{cat.label}</span>
                </Link>
              );
            })}
          </div>
        </Reveal>

        <Reveal>
          <SafetySection />
        </Reveal>

        {/* Final CTA */}
        <Reveal as="section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#18A999] border-2 border-ink rounded-3xl shadow-md p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-white">
              Got a plan? Host it.
            </h2>
            <Link to="/create" className="pressable inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#111111] text-base font-bold border-2 border-ink shadow-sm self-start md:self-auto">
              Host a Hangout
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        {/* FAQ */}
        <Reveal>
          <HomeFaq />
        </Reveal>
      </div>
    </PageTransition>
  );
}
