import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Sparkles, ArrowRight, Shield, Users, Globe } from 'lucide-react';
import Button from '../components/common/Button';
import HangoutCard from '../components/hangout/HangoutCard';
import EmptyState from '../components/common/EmptyState';
import LocationAutocomplete from '../components/common/LocationAutocomplete';
import PageTransition from '../components/layout/PageTransition';
import { useLeenkit } from '../context/LeenkitContext';
import { useLocationContext } from '../context/LocationContext';
import { CATEGORIES } from '../data/categories';
import SafetySection from '../components/safety/SafetySection';
import { isOpenHangout, sortByEventDate } from '../utils/format';

export default function Home() {
  const { hangouts, isHangoutsLoading } = useLeenkit();
  const { setSearchLocation, activeSearchLocation } = useLocationContext();
  const navigate = useNavigate();

  const upcomingHangouts = sortByEventDate(hangouts.filter(isOpenHangout));
  const globalHighlights = upcomingHangouts.slice(0, 4);

  const handleSelectLocation = (placeObj) => {
    if (placeObj) {
      setSearchLocation(placeObj);
      navigate('/explore');
    }
  };

  return (
    <PageTransition>
      <div className="space-y-20 pb-10">
        {/* HERO SECTION */}
        <section className="relative pt-12 md:pt-20 pb-16 overflow-hidden">
          <span className="accent-orb -left-10 top-10 w-28 h-28 bg-[#18A999]/6" />
          <span className="accent-orb right-16 top-20 w-2.5 h-2.5 bg-[#FFD166]" />
          <span className="accent-orb left-[42%] bottom-6 w-14 h-14 border border-[#18A999]/15" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Hero Text */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.12, delayChildren: 0.05 }
                  }
                }}
                className="lg:col-span-7 space-y-6 text-left"
              >
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFD166] border border-[#E6A800]/30 text-[#172121] text-xs font-bold shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#172121]" />
                  <span>Real-Life Hangouts · Zero Pressure</span>
                </motion.div>

                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 18 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-['Bricolage_Grotesque',sans-serif] text-[#172121] tracking-tight leading-[1.05]"
                >
                  Find your people. <br />
                  <span className="relative inline-block text-[#18A999]">
                    Find a Hangout.
                    <svg
                      className="absolute left-0 -bottom-2.5 w-full h-3 text-[#18A999]/80 overflow-visible"
                      viewBox="0 0 300 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <motion.path
                        d="M2 6 C 50 1, 100 11, 150 6 C 200 1, 250 11, 298 6"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        animate={{ x: [-12, 12, -12] }}
                        transition={{
                          duration: 2.4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </svg>
                  </span>
                </motion.h1>

                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
                  }}
                  className="text-lg md:text-xl text-[#3D4948] font-medium leading-relaxed max-w-2xl"
                >
                  LEENKIT helps people turn <strong className="text-[#172121]">“we should do something sometime”</strong> into real-life Hangouts. Discover local gatherings, meet around shared interests, and bring people together.
                </motion.p>

                {/* Location Search Input */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } }
                  }}
                  className="pt-2 max-w-xl space-y-2"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-[#3D4948]">
                    Where do you want to explore?
                  </p>
                  <LocationAutocomplete
                    value={activeSearchLocation}
                    onSelectLocation={handleSelectLocation}
                    label="Where do you want to explore?"
                  />
                </motion.div>

                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } }
                  }}
                  className="flex flex-wrap items-center gap-4 pt-2"
                >
                  <Link to="/explore">
                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                      <Button variant="primary" size="lg" showArrow>
                        Explore Hangouts
                      </Button>
                    </motion.div>
                  </Link>

                  <Link to="/create">
                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                      <Button variant="outline" size="lg">
                        Create a Hangout
                      </Button>
                    </motion.div>
                  </Link>
                </motion.div>

                <div className="pt-6 border-t border-[#DDE3E0]">
                  <p className="text-xs text-[#3D4948]">
                    <strong className="text-[#172121]">Free to join or host.</strong> Every Hangout has a real venue, a host you can see, and a group chat for the people going.
                  </p>
                </div>
              </motion.div>

              {/* Hero Editorial Overlapping Cards Visual */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto max-w-md lg:max-w-none" aria-hidden="true">
                  {/* Card 1: Jabi Lake Kayaking */}
                  <motion.div
                    initial={{ rotate: -3, y: 0 }}
                    animate={{ rotate: -2, y: [0, -6, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="group editorial-card p-5 bg-white shadow-xl rounded-3xl relative z-10 border border-[#DDE3E0]"
                  >
                    <div className="relative h-48 rounded-2xl overflow-hidden mb-4 img-zoom">
                      <img
                        src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80"
                        alt="Jabi Lake Kayaking"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-[#172121]/80 backdrop-blur-xs text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full">
                        Outdoors
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center text-xs text-[#18A999] font-semibold gap-1">
                        <MapPin className="w-3.5 h-3.5" /> Jabi Lake Park, Abuja
                      </div>
                      <h3 className="text-lg font-bold font-heading text-[#172121]">Jabi Lake Sunset Kayaking</h3>
                      <div className="flex items-center justify-between pt-2 border-t border-[#DDE3E0]">
                        <span className="text-xs font-semibold text-[#3D4948]">Example Hangout</span>
                        <span className="text-xs font-semibold text-[#3D4948]">Mon · 5:00 PM</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Card 2: Shoreditch Photowalk */}
                  <motion.div
                    initial={{ rotate: 4, x: 20, y: -20 }}
                    animate={{ rotate: 3, x: 20, y: [-20, -28, -20] }}
                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="editorial-card p-4 bg-[#172121] text-white shadow-2xl rounded-2xl hidden sm:block absolute -top-8 -right-6 z-20 max-w-[240px]"
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#172121] bg-[#FFD166] px-2 py-0.5 rounded-full">
                      Photography
                    </span>
                    <h4 className="font-heading font-bold text-sm text-white mt-2">Shoreditch Vintage Walk</h4>
                    <p className="text-xs text-stone-400 mt-1">Example Hangout</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: GLOBAL HIGHLIGHTS */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Live Hangouts</span>
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-[#172121] mt-1">
                Coming up soon
              </h2>
            </div>
            <Link to="/explore" className="text-sm font-semibold text-[#18A999] hover:underline flex items-center gap-1 link-nudge">
              <span>View all Hangouts</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {isHangoutsLoading ? (
              [0, 1, 2, 3].map(i => (
                <div key={i} className="h-72 bg-white border border-[#E8E6E1] rounded-3xl animate-pulse" aria-hidden="true" />
              ))
            ) : globalHighlights.length === 0 ? (
              <div className="col-span-full py-6 text-center">
                <EmptyState
                  title="No Hangouts yet"
                  description="Be the first to host a Hangout in your area!"
                  actionLabel="Create a Hangout"
                  onAction={() => navigate('/create')}
                />
              </div>
            ) : (
              globalHighlights.map(hangout => (
                <HangoutCard key={hangout.id} hangout={hangout} />
              ))
            )}
          </div>
        </motion.section>

        {/* SECTION 2: YOU MIGHT ENJOY (CATEGORIES) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="relative bg-white border border-[#DDE3E0] rounded-3xl p-8 md:p-12 shadow-xs space-y-8 overflow-hidden">
            <span className="accent-orb -right-6 -top-6 w-20 h-20 bg-[#18A999]/5" />
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Explore by Interest</span>
              <h2 className="text-3xl font-extrabold font-['Bricolage_Grotesque',sans-serif] text-[#172121] mt-1">
                You might enjoy
              </h2>
              <p className="text-sm text-[#3D4948] mt-2">
                Find Hangouts based on what genuinely makes your week worthwhile.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                const Icon = cat.icon;
                return (
                  <Link
                    key={cat.id}
                    to={`/explore?category=${cat.id}`}
                    className="pressable p-4 rounded-2xl bg-[#DDF4EF] border border-[#DDE3E0] hover:bg-[#18A999] hover:text-white hover:-translate-y-0.5 group transition-all duration-200 text-center flex flex-col items-center justify-center space-y-2 cursor-pointer shadow-xs"
                  >
                    {Icon && <Icon className="w-6 h-6 text-[#18A999] group-hover:text-white transition-colors duration-200 group-hover:scale-110 transition-transform" />}
                    <span className="text-xs font-bold font-heading text-[#172121] group-hover:text-white transition-colors">
                      {cat.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* SECTION 3: PRODUCT PHILOSOPHY QUOTE */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="relative overflow-hidden bg-[#172121] text-white rounded-3xl p-8 md:p-16 shadow-2xl">
            <div className="relative z-10 max-w-3xl space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-[#18A999] flex items-center justify-center text-white">
                <Sparkles className="w-6 h-6" />
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold font-heading text-white leading-tight">
                "The Hangout is the social unit, not the profile."
              </h2>

              <p className="text-stone-300 text-base md:text-lg leading-relaxed">
                LEENKIT works wherever people are — from major cities to local neighborhood parks, coffee houses, and sports fields. Every Hangout links to a real venue on Google Maps.
              </p>

              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-stone-400">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#18A999]" /> Real-Life Gatherings
                </span>
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#18A999]" /> Real Venues, Real People
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#18A999]" /> Temporary Hangout Spaces
                </span>
              </div>
            </div>

            {/* Decorative background glow */}
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-[#18A999]/20 rounded-full blur-3xl" />
          </div>
        </motion.section>

        {/* SAFETY & TRUST SECTION */}
        <SafetySection />

        {/* SECTION 4: FINAL CTA */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto px-4 text-center space-y-6 pt-8"
        >
          <div className="relative overflow-hidden bg-[#DDF4EF] border border-[#18A999]/20 rounded-3xl p-10 md:p-14 space-y-6">
            <span className="accent-orb left-6 -top-4 w-3 h-3 bg-[#FFD166] rotate-12" />
            <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-[#172121]">
              Ready to host or join a Hangout?
            </h2>
            <p className="text-base text-[#3D4948] max-w-lg mx-auto leading-relaxed">
              Discover Hangouts near you or host your own casual meetup in less than two minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link to="/explore">
                <Button variant="primary" size="lg" showArrow>
                  Explore Hangouts
                </Button>
              </Link>
              <Link to="/create">
                <Button variant="outline" size="lg">
                  Create a Hangout
                </Button>
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </PageTransition>
  );
}
