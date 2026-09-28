import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import HangoutCard from '../components/hangout/HangoutCard';
import EmptyState from '../components/common/EmptyState';
import { Calendar, Shield, CheckCircle2, Compass } from 'lucide-react';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';

export default function MyHangouts() {
  const navigate = useNavigate();
  const { hangouts } = useLeenkit();
  const { currentUser, isAuthLoading } = useUser();
  const [activeTab, setActiveTab] = useState('upcoming');

  // Loading guard while Supabase restores authentication session
  if (isAuthLoading) {
    return (
      <PageTransition>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
          <div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#6F6F6F]">Loading your Hangouts...</p>
        </div>
      </PageTransition>
    );
  }

  const userId = currentUser?.id;

  // Filtered lists safely guarded with userId
  const upcomingJoined = userId ? hangouts.filter(h =>
    h.attendeeIds &&
    h.attendeeIds.includes(userId) &&
    h.hostId !== userId &&
    h.status === 'upcoming'
  ) : [];

  const hostingHangouts = userId ? hangouts.filter(h =>
    h.hostId === userId
  ) : [];

  const pastHangouts = userId ? hangouts.filter(h =>
    ((h.attendeeIds && h.attendeeIds.includes(userId)) || h.hostId === userId) &&
    h.status === 'completed'
  ) : [];

  const getActiveList = () => {
    switch (activeTab) {
      case 'hosting':
        return hostingHangouts;
      case 'past':
        return pastHangouts;
      case 'upcoming':
      default:
        return upcomingJoined;
    }
  };

  const currentList = getActiveList();

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">
            Your Schedule
          </span>
          <h1 className="text-4xl font-extrabold font-heading text-[#171717]">
            My Hangouts
          </h1>
          <p className="text-sm text-[#6F6F6F]">
            Manage Hangouts you are hosting or attending.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E6E1] pb-1">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'upcoming'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#6F6F6F] hover:text-[#171717] hover:bg-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Upcoming ({upcomingJoined.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('hosting')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'hosting'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#6F6F6F] hover:text-[#171717] hover:bg-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Hosting ({hostingHangouts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'past'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-[#6F6F6F] hover:text-[#171717] hover:bg-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Past ({pastHangouts.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        {currentList.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={
              activeTab === 'hosting'
                ? "You haven't hosted a Hangout yet"
                : activeTab === 'past'
                ? "No completed Hangouts yet"
                : "Your calendar looks a little empty"
            }
            description="Find real-life Hangouts happening near you or host your own."
            actionLabel="Explore Hangouts"
            onAction={() => navigate('/explore')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {currentList.map(hangout => (
              <HangoutCard key={hangout.id} hangout={hangout} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
