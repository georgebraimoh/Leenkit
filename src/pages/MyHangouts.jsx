import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  Plus,
  MessageSquare,
  ExternalLink,
  Share2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Compass,
  MapPin,
  Tag,
  RotateCcw
} from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import AvatarStack from '../components/common/AvatarStack';
import ShareModal from '../components/common/ShareModal';
import EmptyState from '../components/common/EmptyState';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80";

export default function MyHangouts() {
  const navigate = useNavigate();
  const { hangouts, isHangoutsLoading, cancelHangout, completeHangout } = useLeenkit();
  const { currentUser, isAuthLoading, isAuthenticated, openAuthModal } = useUser();

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled'
  const [shareHangout, setShareHangout] = useState(null);
  const [cancelModalHangout, setCancelModalHangout] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [hasError, setHasError] = useState(false);

  const userId = currentUser?.id;

  // Filter hosted hangouts strictly by ownership (hostId === userId)
  const hostedHangouts = useMemo(() => {
    if (!userId || !Array.isArray(hangouts)) return [];
    return hangouts.filter(h => h.hostId === userId);
  }, [userId, hangouts]);

  // Metric calculations
  const upcomingHosted = useMemo(() => {
    return hostedHangouts.filter(h => h.status === 'upcoming');
  }, [hostedHangouts]);

  const completedHosted = useMemo(() => {
    return hostedHangouts.filter(h => h.status === 'completed');
  }, [hostedHangouts]);

  const cancelledHosted = useMemo(() => {
    return hostedHangouts.filter(h => h.status === 'cancelled');
  }, [hostedHangouts]);

  const totalAttendeesReached = useMemo(() => {
    return hostedHangouts.reduce((acc, h) => {
      const count = (h.attendeeIds || []).length;
      return acc + count;
    }, 0);
  }, [hostedHangouts]);

  // Tab content filtering
  const currentTabList = useMemo(() => {
    switch (activeTab) {
      case 'completed':
        return completedHosted;
      case 'cancelled':
        return cancelledHosted;
      case 'upcoming':
      default:
        return upcomingHosted;
    }
  }, [activeTab, upcomingHosted, completedHosted, cancelledHosted]);

  // Action Handlers
  const handleMarkCompleted = async (hangoutId) => {
    setIsProcessingAction(true);
    try {
      await completeHangout(hangoutId);
    } catch (err) {
      console.error('Error completing Hangout:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalHangout) return;
    setIsProcessingAction(true);
    try {
      await cancelHangout(cancelModalHangout.id);
      setCancelModalHangout(null);
    } catch (err) {
      console.error('Error cancelling Hangout:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Loading Guard
  if (isAuthLoading || isHangoutsLoading) {
    return (
      <PageTransition>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#6F6F6F]">Loading your Hangouts dashboard...</p>
        </div>
      </PageTransition>
    );
  }

  // Auth Guard
  if (!isAuthenticated) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-heading text-[#171717]">Your Hangouts</h2>
            <p className="text-sm text-[#6F6F6F]">
              Sign in to manage your hosted Hangouts, view attendee lists, and track event progress.
            </p>
          </div>
          <Button onClick={() => openAuthModal('login')} variant="primary" size="lg" fullWidth>
            Sign In to Access Dashboard
          </Button>
        </div>
      </PageTransition>
    );
  }

  // Error State
  if (hasError) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-heading text-[#171717]">We couldn't load your Hangouts</h2>
            <p className="text-sm text-[#6F6F6F]">
              An issue occurred while fetching your hosted events. Please try again.
            </p>
          </div>
          <Button
            onClick={() => {
              setHasError(false);
              window.location.reload();
            }}
            variant="outline"
            size="md"
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4 text-[#18A999]" />
            <span>Try Again</span>
          </Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
        {/* Share Modal */}
        {shareHangout && (
          <ShareModal
            isOpen={Boolean(shareHangout)}
            onClose={() => setShareHangout(null)}
            hangout={shareHangout}
          />
        )}

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {cancelModalHangout && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-[#DDE3E0] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold font-heading text-[#171717]">
                    Cancel this Hangout?
                  </h3>
                  <p className="text-sm text-[#6F6F6F] leading-relaxed">
                    People who joined may be expecting this Hangout to happen as planned. This action will mark the event as cancelled.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <Button
                    onClick={() => setCancelModalHangout(null)}
                    disabled={isProcessingAction}
                    variant="outline"
                    size="md"
                    fullWidth
                  >
                    Keep Hangout
                  </Button>
                  <Button
                    onClick={handleConfirmCancel}
                    disabled={isProcessingAction}
                    variant="danger"
                    size="md"
                    fullWidth
                  >
                    {isProcessingAction ? 'Cancelling...' : 'Cancel Hangout'}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#DDF4EF] text-[#18A999] rounded-full">
                Host Dashboard
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[#172121] tracking-tight">
              Your Hangouts
            </h1>
            <p className="text-sm text-[#6F6F6F] max-w-2xl">
              Manage the Hangouts you've created, keep track of your attendees, and stay on top of what's happening.
            </p>
          </div>

          <div>
            <Link to="/create">
              <Button variant="primary" size="md" className="gap-2 shadow-sm shrink-0">
                <Plus className="w-4 h-4" />
                <span>Create Hangout</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Dashboard Summary Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Hangouts Hosted */}
          <div className="p-5 bg-white border border-[#DDE3E0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Total Hosted</span>
              <div className="w-8 h-8 rounded-xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold font-heading text-[#171717]">
              {hostedHangouts.length}
            </p>
          </div>

          {/* 2. Upcoming Hangouts */}
          <div className="p-5 bg-white border border-[#DDE3E0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Upcoming</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold font-heading text-[#171717]">
              {upcomingHosted.length}
            </p>
          </div>

          {/* 3. Completed Hangouts */}
          <div className="p-5 bg-white border border-[#DDE3E0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Completed</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold font-heading text-[#171717]">
              {completedHosted.length}
            </p>
          </div>

          {/* 4. Total Attendees Reached */}
          <div className="p-5 bg-white border border-[#DDE3E0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Attendees Reached</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold font-heading text-[#171717]">
              {totalAttendeesReached}
            </p>
          </div>
        </div>

        {/* Primary Empty State if user has 0 hosted hangouts total */}
        {hostedHangouts.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="You haven't created a Hangout yet."
            description="Create a space, bring people together, and make something happen."
            actionLabel="Create a Hangout"
            onAction={() => navigate('/create')}
          />
        ) : (
          <div className="space-y-6">
            {/* Section / Tab Filters */}
            <div className="flex items-center gap-2 border-b border-[#DDE3E0] pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'upcoming'
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#6F6F6F] hover:text-[#171717] hover:bg-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Upcoming ({upcomingHosted.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'completed'
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#6F6F6F] hover:text-[#171717] hover:bg-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Completed ({completedHosted.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('cancelled')}
                className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'cancelled'
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#6F6F6F] hover:text-[#171717] hover:bg-white'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Cancelled ({cancelledHosted.length})</span>
              </button>
            </div>

            {/* Empty state for specific tab */}
            {currentTabList.length === 0 ? (
              <EmptyState
                icon={Compass}
                title={
                  activeTab === 'completed'
                    ? 'No completed Hangouts yet'
                    : activeTab === 'cancelled'
                    ? 'No cancelled Hangouts'
                    : 'No upcoming Hangouts hosted by you'
                }
                description={
                  activeTab === 'upcoming'
                    ? 'You have no upcoming events scheduled. Host a new Hangout anytime!'
                    : 'Events in this category will show up here.'
                }
                actionLabel={activeTab === 'upcoming' ? 'Create a Hangout' : null}
                onAction={activeTab === 'upcoming' ? () => navigate('/create') : null}
              />
            ) : (
              /* Hangouts Grid / Cards List */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentTabList.map(hangout => {
                  const formattedDate = hangout.date
                    ? new Date(hangout.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })
                    : '';

                  const locationText =
                    typeof hangout.location === 'object'
                      ? (hangout.location.placeName || hangout.location.address || 'Location TBD')
                      : (hangout.location || 'Location TBD');

                  const currencySymbol =
                    hangout.currency === 'NGN' ? '₦' :
                    hangout.currency === 'USD' ? '$' :
                    hangout.currency === 'EUR' ? '€' :
                    hangout.currency === 'GBP' ? '£' :
                    (hangout.currency || '₦');

                  const priceLabel = hangout.isPaid
                    ? `Paid · ${currencySymbol}${Number(hangout.price || 0).toLocaleString()}`
                    : 'Free';

                  const attendeeCount = (hangout.attendeeIds || []).length;
                  const maxCapacity = hangout.maxAttendees || 10;

                  return (
                    <div
                      key={hangout.id}
                      className="bg-white border border-[#DDE3E0] rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      {/* Cover & Badges */}
                      <div className="relative h-48 bg-[#EEF1EF] overflow-hidden">
                        <img
                          src={hangout.image || DEFAULT_COVER_IMAGE}
                          alt={hangout.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
                          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[#172121]/90 backdrop-blur-xs text-white rounded-full shadow-xs">
                            {hangout.category}
                          </span>

                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full shadow-xs backdrop-blur-xs ${
                              hangout.isPaid
                                ? 'bg-amber-500/90 text-white'
                                : 'bg-emerald-600/90 text-white'
                            }`}
                          >
                            {priceLabel}
                          </span>
                        </div>

                        {/* Status Badge Top-Right */}
                        <div className="absolute top-3 right-3 z-10">
                          {hangout.status === 'completed' ? (
                            <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white rounded-full shadow-xs">
                              Completed
                            </span>
                          ) : hangout.status === 'cancelled' ? (
                            <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-rose-600 text-white rounded-full shadow-xs">
                              Cancelled
                            </span>
                          ) : (
                            <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-white rounded-full shadow-xs">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Body */}
                      <div className="p-5 flex-1 space-y-4 flex flex-col justify-between">
                        <div className="space-y-2.5">
                          <h3 className="text-lg font-bold font-heading text-[#171717] line-clamp-2 leading-snug">
                            {hangout.title}
                          </h3>

                          {/* Location */}
                          <div className="flex items-center gap-1.5 text-xs text-[#3D4948]">
                            <MapPin className="w-3.5 h-3.5 text-[#18A999] shrink-0" />
                            <span className="truncate">{locationText}</span>
                          </div>

                          {/* Date & Time */}
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[#3D4948]">
                            <Calendar className="w-3.5 h-3.5 text-[#18A999] shrink-0" />
                            <span>{formattedDate}{hangout.time ? ` · ${hangout.time}` : ''}</span>
                          </div>

                          {/* Attendee Roster Stack */}
                          <div className="pt-2 flex items-center justify-between border-t border-[#E8E6E1]">
                            <div className="flex items-center gap-2">
                              <AvatarStack attendeeIds={hangout.attendeeIds || []} maxVisible={3} size="sm" />
                              <span className="text-xs text-[#3D4948] font-medium">
                                <strong className="text-[#171717] font-bold">{attendeeCount}</strong> / {maxCapacity} attendees
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="pt-3 border-t border-[#DDE3E0] space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Link to={`/hangout/${hangout.id}`} className="block">
                              <Button variant="outline" size="sm" fullWidth className="gap-1.5 text-xs">
                                <ExternalLink className="w-3.5 h-3.5 text-[#18A999]" />
                                <span>Details</span>
                              </Button>
                            </Link>

                            <Link to={`/hangout/${hangout.id}/space`} className="block">
                              <Button variant="secondary" size="sm" fullWidth className="gap-1.5 text-xs">
                                <MessageSquare className="w-3.5 h-3.5 text-[#18A999]" />
                                <span>Space</span>
                              </Button>
                            </Link>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              onClick={() => setShareHangout(hangout)}
                              className="px-3 py-1.5 bg-[#EEF1EF] hover:bg-[#DDF4EF] text-[#171717] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Share Hangout"
                            >
                              <Share2 className="w-3.5 h-3.5 text-[#18A999]" />
                              <span>Share</span>
                            </button>

                            {hangout.status === 'upcoming' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleMarkCompleted(hangout.id)}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Mark as Completed"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Complete</span>
                                </button>

                                <button
                                  onClick={() => setCancelModalHangout(hangout)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Cancel Hangout"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
