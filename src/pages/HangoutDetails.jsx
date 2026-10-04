import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  MessageSquare,
  Check,
  AlertCircle,
  Share2,
  ShieldAlert,
  ExternalLink,
  Tag,
  Heart,
  ArrowLeft,
  CalendarPlus,
  Lock,
  X
} from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import HostCard from '../components/hangout/HostCard';
import EmptyState from '../components/common/EmptyState';
import ShareModal from '../components/common/ShareModal';
import ConfirmModal from '../components/common/ConfirmModal';
import Avatar from '../components/common/Avatar';
import ReportModal from '../components/safety/ReportModal';
import SafetyReminder from '../components/safety/SafetyReminder';
import SponsorHangoutModal from '../components/hangout/SponsorHangoutModal';
import { hangoutService } from '../services/hangout/hangoutService';
import { paymentService } from '../services/payment/paymentService';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/common/Toast';
import { LEGAL_CONTACT_EMAIL } from '../data/legal';
import {
  formatEventDateTime,
  formatMoney,
  closedReason,
  googleCalendarUrl
} from '../utils/format';

const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80';

function DetailsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6 animate-pulse" aria-busy="true" aria-label="Loading Hangout">
      <div className="h-4 w-32 bg-[#E8E6E1] rounded-full" />
      <div className="h-64 sm:h-80 bg-[#E8E6E1] rounded-3xl" />
      <div className="h-8 w-2/3 bg-[#E8E6E1] rounded-xl" />
      <div className="h-24 bg-[#E8E6E1] rounded-2xl" />
    </div>
  );
}

export default function HangoutDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    getHangoutById,
    joinHangout,
    leaveHangout,
    isAttending,
    isHangoutsLoading,
    refreshHangout
  } = useLeenkit();
  const { getUserById, currentUser, isAuthenticated, openAuthModal } = useUser();

  const [isJoining, setIsJoining] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [sponsorshipSummary, setSponsorshipSummary] = useState({ currencies: [], totalSponsorCount: 0 });
  const [imgError, setImgError] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [actionError, setActionError] = useState('');
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const hangout = getHangoutById(id);
  const attending = hangout ? isAttending(hangout.id) : false;
  const isHost = Boolean(currentUser?.id && hangout?.hostId === currentUser.id);
  const isMember = attending || isHost;

  // Deep links: fetch this one Hangout if the list doesn't have it.
  useEffect(() => {
    if (!id || hangout || isHangoutsLoading) return;
    let active = true;
    setIsFetchingSingle(true);
    refreshHangout(id)
      .then(fresh => { if (active && !fresh) setNotFound(true); })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setIsFetchingSingle(false); });
    return () => { active = false; };
  }, [id, hangout, isHangoutsLoading, refreshHangout]);

  const loadSponsorshipSummary = useCallback(async () => {
    if (!id || !isMember) return;
    const res = await hangoutService.fetchHangoutSponsorshipSummary(id);
    if (res) setSponsorshipSummary(res);
  }, [id, isMember]);

  useEffect(() => {
    loadSponsorshipSummary();
  }, [loadSponsorshipSummary]);

  // Returning from Paystack checkout.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference') || urlParams.get('trxref');
    if (!reference || !id) return;

    window.history.replaceState({}, document.title, window.location.pathname);
    setPaymentNotice({ type: 'info', message: 'Confirming your payment...' });

    paymentService.verifyPayment(reference)
      .then(async (res) => {
        if (res.status === 'successful') {
          await refreshHangout(id).catch(() => {});
          await loadSponsorshipSummary();
          setPaymentNotice({ type: 'success', message: 'Payment confirmed. You are in! The Hangout Space is now open to you.' });
        } else if (res.status === 'requires_refund') {
          setPaymentNotice({
            type: 'warning',
            message: `Your payment went through, but we could not confirm your spot (the Hangout filled up, closed, or you were already going). You have not been added as an attendee. Keep your reference ${reference} and email ${LEGAL_CONTACT_EMAIL} about this payment.`
          });
        } else if (res.status === 'pending') {
          setPaymentNotice({ type: 'info', message: 'Your payment is still being confirmed. This page will update once Paystack confirms it; you can refresh in a minute.' });
        } else {
          setPaymentNotice({ type: 'error', message: 'This payment was not completed. You have not been charged for a ticket.' });
        }
      })
      .catch((err) => {
        setPaymentNotice({ type: 'error', message: err.message || 'Could not confirm your payment. Please refresh in a minute.' });
      });
  }, [id, refreshHangout, loadSponsorshipSummary]);

  if (!hangout && (isHangoutsLoading || isFetchingSingle || !notFound)) {
    return (
      <PageTransition>
        <DetailsSkeleton />
      </PageTransition>
    );
  }

  if (!hangout) {
    return (
      <PageTransition>
        <div className="max-w-xl mx-auto px-4 py-20">
          <EmptyState
            icon={AlertCircle}
            title="Hangout not found"
            description="This Hangout may have been removed, or the link is incorrect."
            actionLabel="Explore Hangouts"
            onAction={() => navigate('/explore')}
          />
        </div>
      </PageTransition>
    );
  }

  const attendeeIds = hangout.attendeeIds || [];
  const attendeeCount = hangout.attendeeCount ?? attendeeIds.length;
  const maxAttendees = hangout.maxAttendees || 10;
  const isFull = attendeeCount >= maxAttendees;
  const closed = closedReason(hangout);
  const spotsRemaining = Math.max(0, maxAttendees - attendeeCount);
  const dateTimeLabel = formatEventDateTime(hangout);
  const calendarUrl = googleCalendarUrl(hangout);

  const rawLocation = typeof hangout.location === 'object'
    ? (hangout.location.placeName || hangout.location.address || '')
    : (hangout.location || '');
  const googleMapsUrl = hangout.googleMapsUrl || (typeof hangout.location === 'object' ? hangout.location.googleMapsUrl : null);
  const coverImgSrc = (imgError || !hangout.image) ? DEFAULT_COVER_IMAGE : hangout.image;
  const priceDisplay = hangout.isPaid ? formatMoney(hangout.price, hangout.currency) : 'Free';

  const joinLabel = closed
    ? (closed === 'Cancelled' ? 'Hangout cancelled' : 'Hangout has ended')
    : isFull
      ? 'Hangout is full'
      : isJoining
        ? (hangout.isPaid ? 'Opening checkout...' : 'Joining...')
        : hangout.isPaid
          ? `Get ticket · ${priceDisplay}`
          : 'Join Hangout';
  const joinDisabled = Boolean(closed) || isFull || isJoining;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/explore');
  };

  const handleJoinClick = async () => {
    setActionError('');
    if (!isAuthenticated) {
      openAuthModal('welcome');
      return;
    }

    setIsJoining(true);

    if (!hangout.isPaid) {
      try {
        await joinHangout(hangout.id);
        showToast("You're going! The Hangout Space is open.", 'success');
      } catch (err) {
        setActionError(err.message);
      } finally {
        setIsJoining(false);
      }
      return;
    }

    try {
      const { authorization_url } = await paymentService.initializeTransaction({
        hangoutId: hangout.id,
        paymentType: 'ticket',
        callbackUrl: `${window.location.origin}/hangout/${hangout.id}`
      });
      if (!authorization_url) throw new Error('Checkout link missing. Please try again.');
      window.location.href = authorization_url;
    } catch (err) {
      setActionError(err.message || 'Could not open checkout.');
      setIsJoining(false);
    }
  };

  const handleConfirmLeave = async () => {
    setIsLeaving(true);
    setLeaveError('');
    try {
      await leaveHangout(hangout.id);
      setLeaveConfirmOpen(false);
      showToast('You left the Hangout.', 'success');
    } catch (err) {
      setLeaveError(err.message);
    } finally {
      setIsLeaving(false);
    }
  };

  const notices = [
    actionError && { type: 'error', message: actionError, onClose: () => setActionError('') },
    paymentNotice && { ...paymentNotice, onClose: () => setPaymentNotice(null) }
  ].filter(Boolean);

  return (
    <PageTransition>
      <div className="pb-28 sm:pb-24">
        <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} hangout={hangout} />

        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="activity"
          targetId={hangout.id}
          targetTitle={hangout.title}
        />

        <SponsorHangoutModal
          isOpen={sponsorModalOpen}
          onClose={() => setSponsorModalOpen(false)}
          hangout={hangout}
          onSponsorshipSuccess={loadSponsorshipSummary}
        />

        <ConfirmModal
          isOpen={leaveConfirmOpen}
          onClose={() => { setLeaveConfirmOpen(false); setLeaveError(''); }}
          onConfirm={handleConfirmLeave}
          title="Leave this Hangout?"
          message={hangout.isPaid
            ? 'You will lose access to the Hangout Space. Leaving does not refund your ticket.'
            : 'You will lose access to the Hangout Space. You can join again while spots are open.'}
          confirmLabel="Leave Hangout"
          isLoading={isLeaving}
          error={leaveError}
        />

        {/* Top bar */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#6F6F6F] hover:text-[#171717] transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <Button onClick={() => setShareModalOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-[#18A999]" aria-hidden="true" />
              <span>Share</span>
            </Button>
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              aria-label="Report this Hangout"
              title="Report this Hangout"
              className="p-2 rounded-full text-[#6F6F6F] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer pressable"
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Notices */}
        {notices.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4 space-y-2" aria-live="polite">
            {notices.map((n, i) => (
              <div
                key={i}
                role={n.type === 'error' ? 'alert' : 'status'}
                className={`p-4 border rounded-2xl text-sm font-medium flex items-start justify-between gap-3 ${
                  n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  n.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                  n.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                  'bg-teal-50 border-teal-200 text-teal-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{n.message}</span>
                </div>
                <button type="button" onClick={n.onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100 cursor-pointer">
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Cover */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-8">
          <div className="relative h-64 sm:h-80 md:h-[380px] rounded-3xl overflow-hidden shadow-md border border-[#E8E6E1] bg-stone-100">
            <img
              src={coverImgSrc}
              alt=""
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover ${closed ? 'grayscale' : ''}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
            <div className="absolute top-5 left-5 right-5 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-white text-[#171717] rounded-full shadow-md">
                  {hangout.category || 'Hangout'}
                </span>
                <span className={`px-3.5 py-1.5 text-xs font-bold rounded-full shadow-md ${hangout.isPaid ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                  {priceDisplay}
                </span>
              </div>
              {closed ? (
                <span className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-stone-800 text-white rounded-full shadow-md">{closed}</span>
              ) : isFull ? (
                <span className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-rose-500 text-white rounded-full shadow-md">Full</span>
              ) : (
                <span className="px-3.5 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-full shadow-md">
                  {spotsRemaining} {spotsRemaining === 1 ? 'spot left' : 'spots left'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main column */}
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-heading text-[#171717] tracking-tight leading-tight">
                {hangout.title}
              </h1>

              {closed && (
                <p className="p-3 bg-stone-100 border border-stone-200 rounded-2xl text-sm font-medium text-stone-700">
                  {closed === 'Cancelled'
                    ? 'The host cancelled this Hangout. It is no longer taking attendees.'
                    : 'This Hangout has already happened.'}
                </p>
              )}

              <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-[#6F6F6F]">Date & time</span>
                    <p className="text-sm font-bold text-[#171717] font-heading">{dateTimeLabel || 'Date TBD'}</p>
                    {calendarUrl && !closed && (
                      <a
                        href={calendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#087F73] hover:underline"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        Add to calendar
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-[#6F6F6F]">Admission</span>
                    <p className="text-sm font-bold font-heading">
                      {hangout.isPaid
                        ? <span className="text-amber-700 font-extrabold">{priceDisplay}</span>
                        : <span className="text-emerald-700 font-bold">Free</span>}
                    </p>
                    {hangout.isPaid && (
                      <p className="text-xs text-[#6F6F6F]">Paid online via Paystack</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-[#6F6F6F]">Location</span>
                    <p className="text-sm font-bold text-[#171717] font-heading break-words">{rawLocation || 'Location TBD'}</p>
                    {googleMapsUrl && (
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-[#18A999] hover:bg-[#087F73] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Open in Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Community support (members only) */}
            {isMember && sponsorshipSummary.currencies.length > 0 && (
              <div className="p-4 sm:p-5 bg-[#DDF4EF]/60 border border-[#18A999]/30 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#18A999] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Heart className="w-5 h-5 fill-white" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-[#087F73]">Community support</span>
                    <div className="space-y-0.5">
                      {sponsorshipSummary.currencies.map(c => (
                        <p key={c.currency} className="text-sm font-bold text-[#171717]">
                          {c.totalPaid > 0 && <span>{formatMoney(c.totalPaid, c.currency)} paid</span>}
                          {c.totalPaid > 0 && c.totalPledged > 0 && <span> · </span>}
                          {c.totalPledged > 0 && (
                            <span className="font-semibold text-[#3D4948]">{formatMoney(c.totalPledged, c.currency)} pledged (unpaid)</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                {!closed && (
                  <Button
                    onClick={() => setSponsorModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-[#18A999] border-[#18A999] hover:bg-[#18A999] hover:text-white transition-colors"
                  >
                    Sponsor
                  </Button>
                )}
              </div>
            )}

            {hangout.description && hangout.description.trim().length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#087F73]">About this Hangout</h2>
                <div className="p-6 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs">
                  <p className="text-base text-[#333] leading-relaxed whitespace-pre-line break-words font-sans">
                    {hangout.description}
                  </p>
                </div>
              </div>
            )}

            <SafetyReminder mode="details" />

            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#087F73]">Host</h2>
              <HostCard hostId={hangout.hostId} />
            </div>

            {/* Who's going */}
            <div className="space-y-4 pt-4 border-t border-[#E8E6E1]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#087F73]">Who's going</h2>
                  <p className="text-sm font-bold text-[#171717] font-heading mt-0.5">
                    {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} going
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#6F6F6F]">
                  {attendeeCount} / {maxAttendees} spots filled
                </span>
              </div>

              {isMember ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {attendeeIds.map(userId => {
                    const user = getUserById(userId);
                    if (!user) return null;
                    const content = (
                      <>
                        <Avatar src={user.avatar} name={user.name} size="lg" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#171717] truncate">
                            {user.name}{userId === hangout.hostId ? ' · Host' : ''}
                          </p>
                          {user.username && <p className="text-xs text-[#6F6F6F] truncate">@{user.username}</p>}
                        </div>
                      </>
                    );
                    return (
                      <li key={userId}>
                        {user.username ? (
                          <Link
                            to={`/profile/${user.username}`}
                            className="p-3 bg-white border border-[#E8E6E1] rounded-2xl flex items-center gap-3 hover:border-[#18A999]/40 transition-colors pressable"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className="p-3 bg-white border border-[#E8E6E1] rounded-2xl flex items-center gap-3">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-4 bg-white border border-[#E8E6E1] rounded-2xl text-sm text-[#3D4948] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#18A999] shrink-0" aria-hidden="true" />
                  For everyone's safety, the guest list is only visible to people going.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div className="editorial-surface p-6 space-y-6 shadow-lg border border-[#E8E6E1] rounded-3xl bg-white">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Status</span>
                <div className="text-xl font-bold font-heading text-[#171717]">
                  {isHost ? (
                    <span className="text-[#087F73]">You're hosting</span>
                  ) : attending ? (
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-5 h-5 stroke-[3]" aria-hidden="true" /> You're going
                    </span>
                  ) : closed ? (
                    <span className="text-stone-600">{closed}</span>
                  ) : isFull ? (
                    <span className="text-rose-600">Hangout full</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="font-bold text-[#18A999]">{spotsRemaining}</span>
                      <span>{spotsRemaining === 1 ? 'spot remaining' : 'spots remaining'}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {isMember ? (
                  <>
                    <Link to={`/hangout/${hangout.id}/space`} className="block">
                      <Button variant="primary" size="lg" fullWidth className="gap-2 shadow-sm">
                        <MessageSquare className="w-5 h-5" aria-hidden="true" />
                        <span>Enter Hangout Space</span>
                      </Button>
                    </Link>

                    {!closed && (
                      <Button
                        onClick={() => setSponsorModalOpen(true)}
                        variant="outline"
                        size="md"
                        fullWidth
                        className="gap-2 border-[#18A999] text-[#18A999] hover:bg-[#18A999]/10"
                      >
                        <Heart className="w-4 h-4 text-[#18A999]" aria-hidden="true" />
                        <span>Sponsor Hangout</span>
                      </Button>
                    )}

                    {!isHost && !closed && (
                      <button
                        type="button"
                        onClick={() => setLeaveConfirmOpen(true)}
                        className="w-full text-xs font-semibold text-rose-700 hover:underline py-1 cursor-pointer text-center"
                      >
                        Leave Hangout
                      </button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={handleJoinClick}
                    disabled={joinDisabled}
                    variant="primary"
                    size="lg"
                    fullWidth
                    showArrow={!joinDisabled}
                  >
                    {joinLabel}
                  </Button>
                )}

                <Button onClick={() => setShareModalOpen(true)} variant="outline" size="md" fullWidth className="gap-2">
                  <Share2 className="w-4 h-4 text-[#18A999]" aria-hidden="true" />
                  <span>Share Hangout</span>
                </Button>
              </div>

              <div className="pt-4 border-t border-[#E8E6E1] space-y-2 text-xs text-[#6F6F6F]">
                <p className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  {hangout.isPaid ? `Ticket: ${priceDisplay}, paid securely via Paystack` : 'Free to join'}
                </p>
                <p className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" /> Group chat with everyone going
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sticky CTA */}
        <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 bg-white border-t border-[#E8E6E1] px-4 py-3 shadow-xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs text-[#6F6F6F] uppercase font-bold tracking-wider block">
              {hangout.isPaid ? priceDisplay : 'Free'}
            </span>
            <p className="text-xs font-bold text-[#171717] font-heading truncate">
              {isHost ? "You're hosting" : attending ? "You're going" : closed || `${attendeeCount}/${maxAttendees} going`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={() => setShareModalOpen(true)} variant="outline" size="sm" className="p-2" aria-label="Share Hangout">
              <Share2 className="w-4 h-4 text-[#18A999]" aria-hidden="true" />
            </Button>

            {isMember ? (
              <Link to={`/hangout/${hangout.id}/space`}>
                <Button variant="primary" size="sm" className="gap-1.5">
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  <span>Enter Space</span>
                </Button>
              </Link>
            ) : (
              <Button onClick={handleJoinClick} disabled={joinDisabled} variant="primary" size="sm">
                {joinLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
