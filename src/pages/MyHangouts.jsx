import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Sparkles,
  Compass,
  MapPin,
  Trash2,
  Ticket
} from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import AvatarStack from '../components/common/AvatarStack';
import ShareModal from '../components/common/ShareModal';
import ConfirmModal from '../components/common/ConfirmModal';
import EmptyState from '../components/common/EmptyState';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/common/Toast';
import { usePaidFeatures } from '../hooks/usePaidFeatures';
import {
  formatEventDate,
  formatEventTime,
  formatMoney,
  hasStarted,
  isPastHangout,
  closedReason,
  sortByEventDate
} from '../utils/format';

const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80';

const TABS = [
  { id: 'going', label: 'Going', icon: Ticket },
  { id: 'upcoming', label: 'Hosting', icon: Clock },
  { id: 'past', label: 'Past', icon: CheckCircle2 },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle }
];

export default function MyHangouts() {
  const { paidEnabled } = usePaidFeatures();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hangouts, isHangoutsLoading, cancelHangout, completeHangout, deleteHangout } = useLeenkit();
  const { currentUser, isAuthLoading, isAuthenticated, openAuthModal } = useUser();

  const [activeTab, setActiveTab] = useState('going');
  const [shareHangout, setShareHangout] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'cancel'|'delete'|'complete', hangout }
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');

  const userId = currentUser?.id;

  const hosted = useMemo(
    () => (userId ? hangouts.filter(h => h.hostId === userId) : []),
    [userId, hangouts]
  );

  const going = useMemo(() => sortByEventDate(
    userId
      ? hangouts.filter(h => h.hostId !== userId && (h.attendeeIds || []).includes(userId) && h.status !== 'cancelled' && !isPastHangout(h))
      : []
  ), [userId, hangouts]);

  const upcomingHosted = useMemo(() => sortByEventDate(hosted.filter(h => h.status === 'upcoming' && !isPastHangout(h))), [hosted]);
  const pastHangouts = useMemo(() => (userId ? hangouts.filter(h =>
    h.status !== 'cancelled' &&
    (h.status === 'completed' || isPastHangout(h)) &&
    (h.hostId === userId || (h.attendeeIds || []).includes(userId))
  ) : []).sort((a, b) => String(b.date).localeCompare(String(a.date))), [userId, hangouts]);
  const cancelledHosted = useMemo(() => hosted.filter(h => h.status === 'cancelled'), [hosted]);

  const totalAttendeesReached = useMemo(
    () => hosted.reduce((acc, h) => acc + Math.max(0, (h.attendeeCount ?? (h.attendeeIds || []).length) - 1), 0),
    [hosted]
  );

  const lists = { going, upcoming: upcomingHosted, past: pastHangouts, cancelled: cancelledHosted };
  const currentTabList = lists[activeTab] || [];

  const runAction = async () => {
    if (!pendingAction) return;
    const { type, hangout } = pendingAction;
    setIsProcessing(true);
    setActionError('');
    try {
      if (type === 'cancel') await cancelHangout(hangout.id);
      if (type === 'complete') await completeHangout(hangout.id);
      if (type === 'delete') await deleteHangout(hangout.id);
      setPendingAction(null);
      showToast(
        type === 'cancel' ? 'Hangout cancelled. Attendees have been notified.' :
        type === 'complete' ? 'Marked as completed.' :
        'Hangout deleted.',
        'success'
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAuthLoading || isHangoutsLoading) {
    return (
      <PageTransition>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4" aria-busy="true">
          <div className="w-10 h-10 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#6F6F6F]">Loading your Hangouts...</p>
        </div>
      </PageTransition>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-heading text-[#171717]">Your Hangouts</h1>
            <p className="text-sm text-[#6F6F6F]">Sign in to see the Hangouts you're going to and the ones you host.</p>
          </div>
          <Button onClick={() => openAuthModal('login')} variant="primary" size="lg" fullWidth>
            Sign in
          </Button>
        </div>
      </PageTransition>
    );
  }

  const confirmCopy = pendingAction && {
    cancel: {
      title: 'Cancel this Hangout?',
      message: pendingAction.hangout.isPaid
        ? 'Everyone going will be notified, and everyone who paid (tickets and sponsorships) is refunded in full automatically. This cannot be undone.'
        : 'Everyone going will be notified and the Hangout will stop taking new people.',
      confirmLabel: 'Cancel Hangout',
      variant: 'danger'
    },
    complete: {
      title: 'Mark as completed?',
      message: 'The Hangout will move to Past and stop taking new people.',
      confirmLabel: 'Mark completed',
      variant: 'primary'
    },
    delete: {
      title: 'Delete this Hangout?',
      message: 'This permanently removes the Hangout and its Space messages. Hangouts with payments cannot be deleted.',
      confirmLabel: 'Delete permanently',
      variant: 'danger'
    }
  }[pendingAction.type];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
        {shareHangout && (
          <ShareModal isOpen={Boolean(shareHangout)} onClose={() => setShareHangout(null)} hangout={shareHangout} />
        )}

        <ConfirmModal
          isOpen={Boolean(pendingAction)}
          onClose={() => { setPendingAction(null); setActionError(''); }}
          onConfirm={runAction}
          title={confirmCopy?.title}
          message={confirmCopy?.message}
          confirmLabel={confirmCopy?.confirmLabel}
          variant={confirmCopy?.variant}
          cancelLabel="Keep it"
          isLoading={isProcessing}
          error={actionError}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[#172121] tracking-tight">Your Hangouts</h1>
            <p className="text-sm text-[#6F6F6F] max-w-2xl">Hangouts you're going to, and the ones you host.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          {paidEnabled && (
          <Link to="/payouts">
            <Button variant="outline" size="md" className="shrink-0">Payouts & earnings</Button>
          </Link>
          )}
          <Link to="/create">
            <Button variant="primary" size="md" className="gap-2 shadow-sm shrink-0">
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Host a Hangout</span>
            </Button>
          </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Going', value: going.length, icon: Ticket },
            { label: 'Hosting', value: upcomingHosted.length, icon: Sparkles },
            { label: 'Total hosted', value: hosted.length, icon: CheckCircle2 },
            { label: 'Guests hosted', value: totalAttendeesReached, icon: Users }
          ].map(stat => (
            <div key={stat.label} className="p-5 bg-white border border-[#DDE3E0] rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-[#18A999]" aria-hidden="true" />
              </div>
              <p className="text-3xl font-extrabold font-heading text-[#171717]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-[#DDE3E0] pb-2 overflow-x-auto" role="tablist" aria-label="Your Hangouts">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === tab.id ? 'bg-[#171717] text-white shadow-xs' : 'text-[#3D4948] hover:text-[#171717] hover:bg-white'
                }`}
              >
                <tab.icon className="w-4 h-4" aria-hidden="true" />
                <span>{tab.label} ({(lists[tab.id] || []).length})</span>
              </button>
            ))}
          </div>

          {currentTabList.length === 0 ? (
            <EmptyState
              icon={Compass}
              title={
                activeTab === 'going' ? "You haven't joined any upcoming Hangouts" :
                activeTab === 'upcoming' ? "You're not hosting anything right now" :
                activeTab === 'past' ? 'No past Hangouts yet' :
                'No cancelled Hangouts'
              }
              description={
                activeTab === 'going' ? 'Find something happening near you.' :
                activeTab === 'upcoming' ? 'Host a Hangout and bring people together.' :
                'They will show up here.'
              }
              actionLabel={activeTab === 'going' ? 'Explore Hangouts' : activeTab === 'upcoming' ? 'Host a Hangout' : null}
              onAction={activeTab === 'going' ? () => navigate('/explore') : activeTab === 'upcoming' ? () => navigate('/create') : null}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentTabList.map(hangout => {
                const isHost = hangout.hostId === userId;
                const closed = closedReason(hangout);
                const locationText = typeof hangout.location === 'object'
                  ? (hangout.location.placeName || hangout.location.address || 'Location TBD')
                  : (hangout.location || 'Location TBD');
                const attendeeCount = hangout.attendeeCount ?? (hangout.attendeeIds || []).length;
                const priceLabel = hangout.isPaid ? `Paid · ${formatMoney(hangout.price, hangout.currency)}` : 'Free';

                return (
                  <article
                    key={hangout.id}
                    className="bg-white border border-[#DDE3E0] rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="relative h-44 bg-[#EEF1EF] overflow-hidden">
                      <img
                        src={hangout.image || DEFAULT_COVER_IMAGE}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover ${closed ? 'grayscale' : ''}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                        <span className="px-3 py-1 text-xs font-bold bg-white/95 text-[#172121] rounded-full shadow-xs">
                          {isHost ? 'Hosting' : 'Going'}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full shadow-xs ${hangout.isPaid ? 'bg-amber-500/90 text-white' : 'bg-emerald-600/90 text-white'}`}>
                          {priceLabel}
                        </span>
                      </div>
                      {closed && (
                        <span className="absolute top-3 right-3 px-3 py-1 text-xs font-extrabold uppercase tracking-wider bg-stone-800 text-white rounded-full shadow-xs">
                          {closed}
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 space-y-4 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <h2 className="text-lg font-bold font-heading text-[#171717] line-clamp-2 leading-snug">{hangout.title}</h2>
                        <div className="flex items-center gap-1.5 text-xs text-[#3D4948]">
                          <MapPin className="w-3.5 h-3.5 text-[#18A999] shrink-0" aria-hidden="true" />
                          <span className="truncate">{locationText}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#3D4948]">
                          <Calendar className="w-3.5 h-3.5 text-[#18A999] shrink-0" aria-hidden="true" />
                          <span>
                            {formatEventDate(hangout.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                            {hangout.time ? ` · ${formatEventTime(hangout.time)}` : ''}
                          </span>
                        </div>
                        <div className="pt-2 flex items-center gap-2 border-t border-[#E8E6E1]">
                          <AvatarStack attendeeIds={hangout.attendeeIds || []} maxVisible={3} size="sm" />
                          <span className="text-xs text-[#3D4948] font-medium">
                            <strong className="text-[#171717] font-bold">{attendeeCount}</strong> / {hangout.maxAttendees || 10} going
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#DDE3E0] space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Link to={`/hangout/${hangout.id}`} className="block">
                            <Button variant="outline" size="sm" fullWidth className="gap-1.5 text-xs">
                              <ExternalLink className="w-3.5 h-3.5 text-[#18A999]" aria-hidden="true" />
                              <span>Details</span>
                            </Button>
                          </Link>
                          <Link to={`/hangout/${hangout.id}/space`} className="block">
                            <Button variant="secondary" size="sm" fullWidth className="gap-1.5 text-xs">
                              <MessageSquare className="w-3.5 h-3.5 text-[#18A999]" aria-hidden="true" />
                              <span>Space</span>
                            </Button>
                          </Link>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {!closed && (
                            <button
                              type="button"
                              onClick={() => setShareHangout(hangout)}
                              className="px-3 py-1.5 bg-[#EEF1EF] hover:bg-[#DDF4EF] text-[#171717] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5 text-[#18A999]" aria-hidden="true" />
                              <span>Share</span>
                            </button>
                          )}

                          {isHost && hangout.status === 'upcoming' && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              {hasStarted(hangout) && (
                                <button
                                  type="button"
                                  onClick={() => setPendingAction({ type: 'complete', hangout })}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Complete</span>
                                </button>
                              )}
                              {!isPastHangout(hangout) && (
                                <button
                                  type="button"
                                  onClick={() => setPendingAction({ type: 'cancel', hangout })}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </div>
                          )}

                          {isHost && hangout.status === 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ type: 'delete', hangout })}
                              className="ml-auto px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
