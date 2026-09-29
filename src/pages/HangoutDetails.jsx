import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  ArrowLeft,
  MessageSquare,
  Check,
  AlertCircle,
  Share2,
  ShieldAlert,
  ExternalLink,
  Tag,
  Heart
} from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import HostCard from '../components/hangout/HostCard';
import EmptyState from '../components/common/EmptyState';
import ShareModal from '../components/common/ShareModal';
import ReportModal from '../components/safety/ReportModal';
import SafetyReminder from '../components/safety/SafetyReminder';
import SponsorHangoutModal from '../components/hangout/SponsorHangoutModal';
import { hangoutService } from '../services/hangout/hangoutService';
import { paymentService } from '../services/payment/paymentService';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80";

export default function HangoutDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getHangoutById, joinHangout, leaveHangout, isAttending } = useLeenkit();
  const { getUserById, currentUser, isAuthenticated, openAuthModal } = useUser();

  const [isJoining, setIsJoining] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [sponsorshipSummary, setSponsorshipSummary] = useState({ currencies: [], totalSponsorCount: 0 });
  const [isLoadingSponsorships, setIsLoadingSponsorships] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [payError, setPayError] = useState('');

  const loadSponsorshipSummary = React.useCallback(async () => {
    if (!id) return;
    setIsLoadingSponsorships(true);
    try {
      const res = await hangoutService.fetchHangoutSponsorshipSummary(id);
      if (res) {
        setSponsorshipSummary(res);
      }
    } catch (err) {
      console.warn('Failed to load sponsorship summary:', err);
    } finally {
      setIsLoadingSponsorships(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadSponsorshipSummary();
  }, [loadSponsorshipSummary]);

  // Check URL query parameters for Paystack payment verification return
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference') || urlParams.get('trxref');
    
    if (reference && id) {
      // Clear URL query parameters without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setPaymentNotice({ type: 'info', message: 'Verifying payment with server...' });
      paymentService.verifyPayment(reference)
        .then((res) => {
          if (res.status === 'successful') {
            setPaymentNotice({ type: 'success', message: 'Payment verified! Welcome to the Hangout 🎉' });
            loadSponsorshipSummary();
          } else if (res.status === 'requires_refund') {
            setPaymentNotice({ type: 'warning', message: 'Payment received, but full capacity was reached before completion. Your payment has been flagged for host/support refund.' });
          } else if (res.status === 'pending') {
            setPaymentNotice({ type: 'info', message: 'Payment is pending server verification. Access will be unlocked automatically once confirmed.' });
          } else {
            setPaymentNotice({ type: 'error', message: 'Payment verification failed or was cancelled.' });
          }
        })
        .catch((err) => {
          setPaymentNotice({ type: 'error', message: err.message || 'Could not verify payment.' });
        });
    }
  }, [id, loadSponsorshipSummary]);

  const hangout = getHangoutById(id);

  if (!hangout) {
    return (
      <PageTransition>
        <div className="max-w-xl mx-auto px-4 py-20">
          <EmptyState
            icon={AlertCircle}
            title="Hangout not found"
            description="We couldn't load this Hangout. It may have been removed or doesn't exist."
            actionLabel="Back to discovery"
            onAction={() => navigate('/explore')}
          />
        </div>
      </PageTransition>
    );
  }

  const attending = isAttending(hangout.id);
  const isHost = Boolean(currentUser?.id && hangout.hostId === currentUser.id);
  const attendeeIds = hangout.attendeeIds || [];
  const maxAttendees = hangout.maxAttendees || 10;
  const isFull = attendeeIds.length >= maxAttendees;

  const formattedDate = hangout.date
    ? new Date(hangout.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  // Extract raw location string without appending artificial city/country fallbacks
  const rawLocation = typeof hangout.location === 'object'
    ? (hangout.location.placeName || hangout.location.address || '')
    : (hangout.location || '');

  // Extract optional Google Maps URL
  const googleMapsUrl = hangout.googleMapsUrl || (typeof hangout.location === 'object' ? hangout.location.googleMapsUrl : null);

  const handleJoinClick = async () => {
    if (!isAuthenticated) {
      openAuthModal('welcome');
      return;
    }

    if (!hangout.isPaid) {
      // Free Hangout: Instant join
      setIsJoining(true);
      try {
        await joinHangout(hangout.id);
      } catch (err) {
        console.error('Error joining Hangout:', err);
      } finally {
        setIsJoining(false);
      }
      return;
    }

    // Paid Hangout: Redirect to server authorization_url (NO client-side join call)
    setIsJoining(true);
    setPayError('');
    try {
      const { authorization_url } = await paymentService.initializeTransaction({
        hangoutId: hangout.id,
        paymentType: 'ticket',
        callbackUrl: `${window.location.origin}/hangout/${hangout.id}`,
      });

      if (authorization_url) {
        window.location.href = authorization_url;
      } else {
        throw new Error('Paystack checkout URL missing.');
      }
    } catch (err) {
      console.error('Payment initialization error:', err);
      setPayError(err.message || 'Could not initialize payment.');
      setIsJoining(false);
    }
  };

  const handleLeaveClick = async () => {
    if (window.confirm("Are you sure you want to leave this Hangout?")) {
      try {
        await leaveHangout(hangout.id);
      } catch (err) {
        console.error('Error leaving Hangout:', err);
      }
    }
  };

  const spotsRemaining = Math.max(0, maxAttendees - attendeeIds.length);
  const coverImgSrc = (imgError || !hangout.image) ? DEFAULT_COVER_IMAGE : hangout.image;
  const currencySymbol = hangout.currency === 'NGN' ? '₦' : hangout.currency === 'USD' ? '$' : hangout.currency === 'EUR' ? '€' : hangout.currency === 'GBP' ? '£' : hangout.currency || '₦';
  const priceDisplay = hangout.isPaid ? `${currencySymbol}${Number(hangout.price || 0).toLocaleString()}` : 'Free';

  return (
    <PageTransition>
      <div className="pb-28 sm:pb-24">
        {/* Share, Report & Sponsor Modals */}
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          hangout={hangout}
        />

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
          onSponsorshipSuccess={() => {
            loadSponsorshipSummary();
          }}
        />

        {/* Top Navigation & Actions Bar */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#6F6F6F] hover:text-[#171717] transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span>Back to discovery</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShareModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-[#18A999]" />
              <span>Share Hangout</span>
            </Button>

            <button
              onClick={() => setReportModalOpen(true)}
              className="p-2 rounded-full text-[#6F6F6F] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer pressable"
              title="Report Concern"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Payment Notice / Error Alert Banner */}
        {(paymentNotice || payError) && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
            {payError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{payError}</span>
              </div>
            )}
            {paymentNotice && (
              <div className={`p-4 border rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs ${
                paymentNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                paymentNotice.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                paymentNotice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                'bg-teal-50 border-teal-200 text-teal-800'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentNotice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentNotice(null)}
                  className="text-xs opacity-60 hover:opacity-100 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hero Cover Image Section */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-8">
          <div className="relative h-64 sm:h-80 md:h-[380px] rounded-3xl overflow-hidden shadow-md border border-[#E8E6E1] bg-stone-100">
            <img
              src={coverImgSrc}
              alt={hangout.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

            {/* Category & Status Badges Overlay */}
            <div className="absolute top-5 left-5 right-5 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-white text-[#171717] rounded-full shadow-md">
                  {hangout.category || 'Hangout'}
                </span>
                <span
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-full shadow-md ${
                    hangout.isPaid ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {priceDisplay}
                </span>
              </div>
              {isFull ? (
                <span className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-rose-500 text-white rounded-full shadow-md">
                  Full Capacity
                </span>
              ) : (
                <span className="px-3.5 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-full shadow-md">
                  {spotsRemaining} {spotsRemaining === 1 ? 'spot left' : 'spots left'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Details & Sidebar Layout */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Title & Metadata Section */}
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-heading text-[#171717] tracking-tight leading-tight">
                {hangout.title}
              </h1>

              {/* Quick Info Grid */}
              <div className="p-5 bg-white border border-[#E8E6E1] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-xs">
                {/* Date & Time */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F6F6F]">Date & Time</span>
                    <p className="text-sm font-bold text-[#171717] font-heading">
                      {formattedDate} {hangout.time ? `· ${hangout.time}` : ''}
                    </p>
                  </div>
                </div>

                {/* Admission Price */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F6F6F]">Admission</span>
                    <p className="text-sm font-bold font-heading">
                      {hangout.isPaid ? (
                        <span className="text-amber-600 font-extrabold">{priceDisplay}</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Free</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Location & Google Maps Link */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF4EF] text-[#18A999] flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F6F6F]">Location</span>
                    <p className="text-sm font-bold text-[#171717] font-heading break-words">
                      {rawLocation || 'Location TBD'}
                    </p>

                    {googleMapsUrl && (
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-[#18A999] hover:bg-[#087F73] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Community Sponsorship Summary Banner — Visible only to members & host */}
            {(attending || isHost) && (isLoadingSponsorships || (sponsorshipSummary.currencies && sponsorshipSummary.currencies.length > 0)) && (
              <div className="p-4 sm:p-5 bg-[#DDF4EF]/60 border border-[#18A999]/30 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#18A999] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Heart className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#087F73]">Community Support</span>
                    {isLoadingSponsorships ? (
                      <p className="text-xs font-semibold text-[#6F6F6F] animate-pulse">Loading community support...</p>
                    ) : (
                      <div className="space-y-0.5">
                        {sponsorshipSummary.currencies.map(c => {
                          const sym = c.currency === 'NGN' ? '₦' : c.currency === 'USD' ? '$' : c.currency === 'EUR' ? '€' : c.currency === 'GBP' ? '£' : c.currency;
                          const countText = c.sponsorCount === 1 ? '1 person' : `${c.sponsorCount} people`;
                          return (
                            <p key={c.currency} className="text-sm font-extrabold text-[#171717]">
                              {sym}{c.totalPledged.toLocaleString()} pledged · {countText}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => setSponsorModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-[#18A999] border-[#18A999] hover:bg-[#18A999] hover:text-white transition-colors"
                >
                  Sponsor
                </Button>
              </div>
            )}

            {/* Description Section */}
            {hangout.description && hangout.description.trim().length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#18A999]">About this Hangout</h3>
                <div className="p-6 bg-white border border-[#E8E6E1] rounded-2xl shadow-xs">
                  <p className="text-base text-[#333] leading-relaxed whitespace-pre-line font-sans">
                    {hangout.description}
                  </p>
                </div>
              </div>
            )}

            {/* Safety Reminder Card */}
            <SafetyReminder mode="details" />

            {/* Host Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Host</h3>
              <HostCard hostId={hangout.hostId} />
            </div>

            {/* Attendee Roster Section */}
            <div className="space-y-4 pt-4 border-t border-[#E8E6E1]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Who's Going</h3>
                  <p className="text-sm font-bold text-[#171717] font-heading mt-0.5">
                    {attendeeIds.length} {attendeeIds.length === 1 ? 'person' : 'people'} going
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#6F6F6F]">
                  {attendeeIds.length} / {maxAttendees} spots filled
                </span>
              </div>

              {/* Attendee Profile Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {attendeeIds.map(userId => {
                  const user = getUserById(userId);
                  if (!user) return null;
                  const initials = user.name ? user.name.substring(0, 2).toUpperCase() : 'QU';

                  return (
                    <Link
                      key={user.id}
                      to={`/profile/${user.username}`}
                      className="p-3 bg-white border border-[#E8E6E1] rounded-2xl flex items-center gap-3 hover:border-[#18A999]/40 transition-colors pressable"
                    >
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#18A999] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171717] truncate">{user.name}</p>
                        {user.username && (
                          <p className="text-[10px] text-[#6F6F6F] truncate">@{user.username}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop Sidebar Action Card */}
          <div className="lg:col-span-4 sticky top-24 space-y-6">
            <div className="editorial-surface p-6 space-y-6 shadow-lg border border-[#E8E6E1] rounded-3xl bg-white">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Status</span>
                <div className="text-xl font-bold font-heading text-[#171717]">
                  {attending ? (
                    <span className="text-emerald-600 flex items-center gap-1.5">
                      <Check className="w-5 h-5 text-emerald-600 stroke-[3]" /> You're attending
                    </span>
                  ) : isFull ? (
                    <span className="text-rose-500">Hangout Full</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="font-bold text-[#18A999]">{spotsRemaining}</span>
                      <span>{spotsRemaining === 1 ? 'spot remaining' : 'spots remaining'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {attending || isHost ? (
                  <>
                    <Link to={`/hangout/${hangout.id}/space`} className="block">
                      <Button variant="primary" size="lg" fullWidth className="gap-2 shadow-sm">
                        <MessageSquare className="w-5 h-5" />
                        <span>Enter Hangout Space</span>
                      </Button>
                    </Link>

                    <Button
                      onClick={() => setSponsorModalOpen(true)}
                      variant="outline"
                      size="md"
                      fullWidth
                      className="gap-2 border-[#18A999] text-[#18A999] hover:bg-[#18A999]/10"
                    >
                      <Heart className="w-4 h-4 text-[#18A999]" />
                      <span>Sponsor Hangout</span>
                    </Button>

                    {!isHost && (
                      <button
                        onClick={handleLeaveClick}
                        className="w-full text-xs font-semibold text-rose-600 hover:underline py-1 cursor-pointer text-center"
                      >
                        Leave Hangout
                      </button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={handleJoinClick}
                    disabled={isJoining || isFull}
                    variant="primary"
                    size="lg"
                    fullWidth
                    showArrow={!isFull && !isJoining}
                  >
                    {isJoining ? 'Joining...' : isFull ? 'Capacity Full' : 'Join Hangout'}
                  </Button>
                )}

                <Button
                  onClick={() => setShareModalOpen(true)}
                  variant="outline"
                  size="md"
                  fullWidth
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4 text-[#18A999]" />
                  <span>Share Hangout</span>
                </Button>
              </div>

              <div className="pt-4 border-t border-[#E8E6E1] space-y-2 text-xs text-[#6F6F6F]">
                <p className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" /> {hangout.isPaid ? `Admission: ${priceDisplay}` : 'Free to join'}
                </p>
                <p className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" /> Instant access to Hangout Space
                </p>
                <p className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" /> Realtime group chat with attendees
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Bottom CTA Bar */}
        <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 bg-white border-t border-[#E8E6E1] px-4 py-3 shadow-xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] text-[#6F6F6F] uppercase font-bold tracking-wider block">Status</span>
            <p className="text-xs font-bold text-[#171717] font-heading truncate">
              {attending ? (
                <span className="flex items-center gap-1">
                  <span>You're going</span>
                  <Check className="w-3.5 h-3.5 text-[#18A999] inline" />
                </span>
              ) : (
                `${attendeeIds.length}/${maxAttendees} going`
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setShareModalOpen(true)}
              variant="outline"
              size="sm"
              className="p-2"
              title="Share Hangout"
            >
              <Share2 className="w-4 h-4 text-[#18A999]" />
            </Button>

            {(attending || isHost) && (
              <Button
                onClick={() => setSponsorModalOpen(true)}
                variant="outline"
                size="sm"
                className="p-2 border-[#18A999] text-[#18A999]"
                title="Sponsor Hangout"
              >
                <Heart className="w-4 h-4 text-[#18A999]" />
              </Button>
            )}

            {attending || isHost ? (
              <Link to={`/hangout/${hangout.id}/space`}>
                <Button variant="primary" size="sm" className="gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>Enter Space</span>
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleJoinClick}
                disabled={isJoining || isFull}
                variant="primary"
                size="sm"
              >
                {isJoining ? 'Joining...' : isFull ? 'Full' : 'Join Hangout'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
