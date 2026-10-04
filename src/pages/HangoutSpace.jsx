import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import SpaceHeader from '../components/space/SpaceHeader';
import ChatMessage from '../components/space/ChatMessage';
import ChatInput from '../components/space/ChatInput';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import ReportModal from '../components/safety/ReportModal';
import { Lock, Sparkles, ShieldAlert, LogOut, MessageSquare, AlertTriangle } from 'lucide-react';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';
import { closedReason } from '../utils/format';
import { useLeaveRefundMessage } from '../hooks/useLeaveRefundMessage';

function dayLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function HangoutSpace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getHangoutById,
    messagesMap,
    sendMessage,
    loadSpaceMessages,
    subscribeToSpaceMessages,
    isAttending,
    isHangoutsLoading,
    leaveHangout,
    refreshHangout
  } = useLeenkit();
  const { currentUser, isAuthLoading, isAuthenticated, openAuthModal } = useUser();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  const isLoading = isAuthLoading || isHangoutsLoading;
  const hangout = isLoading ? null : getHangoutById(id);
  const leaveMessage = useLeaveRefundMessage(hangout, leaveOpen, 'You will lose access to this Space.');
  const roomMessages = (id && messagesMap[id]) ? messagesMap[id] : [];
  const attending = hangout ? isAttending(hangout.id) : false;
  const closed = closedReason(hangout);

  // Deep link: fetch the Hangout if it isn't in the list.
  useEffect(() => {
    if (isLoading || hangout || !id) return;
    let active = true;
    setIsFetchingSingle(true);
    refreshHangout(id)
      .then(fresh => { if (active && !fresh) setNotFound(true); })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setIsFetchingSingle(false); });
    return () => { active = false; };
  }, [id, hangout, isLoading, refreshHangout]);

  useEffect(() => {
    if (!id || !attending || isLoading) return undefined;

    setLoadError('');
    loadSpaceMessages(id).catch(() => setLoadError('Could not load messages. Check your connection.'));
    const unsubscribe = subscribeToSpaceMessages(id);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [id, attending, isLoading, loadSpaceMessages, subscribeToSpaceMessages]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  };

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [roomMessages.length]);

  if (isLoading || (!hangout && (isFetchingSingle || !notFound))) {
    return (
      <PageTransition key="space-loading">
        <div className="max-w-md mx-auto p-10 text-center space-y-4 my-10" aria-busy="true">
          <div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#3D4948]">Connecting to LEENKIT Space...</p>
        </div>
      </PageTransition>
    );
  }

  if (!hangout) {
    return (
      <PageTransition key="space-not-found">
        <div className="max-w-md mx-auto p-10 text-center space-y-4 my-10">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold font-heading text-[#172121]">Hangout not found</h1>
          <Button onClick={() => navigate('/explore')}>Return to Explore</Button>
        </div>
      </PageTransition>
    );
  }

  if (!attending) {
    return (
      <PageTransition key="space-locked">
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#DDE3E0] rounded-3xl p-8 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#087F73]">LEENKIT Space</span>
              <h1 className="text-2xl font-bold font-heading text-[#172121]">People going only</h1>
              <p className="text-sm text-[#3D4948] leading-relaxed">
                The Space for <strong className="text-[#172121]">"{hangout.title}"</strong> is for people going.
                {hangout.isPaid ? ' Get a ticket to join the conversation.' : ' Join the Hangout to chat with everyone.'}
              </p>
            </div>
            <div className="space-y-3 pt-2">
              {!isAuthenticated ? (
                <Button onClick={() => openAuthModal('welcome')} variant="primary" size="lg" fullWidth>
                  Sign in to continue
                </Button>
              ) : (
                <Button onClick={() => navigate(`/hangout/${hangout.id}`)} variant="primary" size="lg" fullWidth showArrow>
                  {closed ? 'View Hangout' : hangout.isPaid ? 'Get a ticket' : 'Join this Hangout'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  const handleSend = async (text) => {
    isNearBottomRef.current = true;
    await sendMessage(hangout.id, text);
  };

  const handleConfirmLeave = async () => {
    setIsLeaving(true);
    setLeaveError('');
    try {
      await leaveHangout(hangout.id);
      navigate(`/hangout/${hangout.id}`);
    } catch (err) {
      setLeaveError(err.message);
      setIsLeaving(false);
    }
  };

  const isHost = currentUser?.id === hangout.hostId;

  return (
    <PageTransition key="space-content">
      <div className="min-h-[100dvh] flex flex-col bg-[#F7F5EF]">
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="space"
          targetId={hangout.id}
          targetTitle={hangout.title}
        />

        <ConfirmModal
          isOpen={leaveOpen}
          onClose={() => { setLeaveOpen(false); setLeaveError(''); }}
          onConfirm={handleConfirmLeave}
          title="Leave this Hangout?"
          message={leaveMessage}
          confirmLabel="Leave Hangout"
          isLoading={isLeaving}
          error={leaveError}
        />

        <SpaceHeader hangout={hangout} />

        <div className="bg-[#DDF4EF] border-b border-[#DDE3E0] px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-[#087F73] font-medium gap-2">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{closed === 'Cancelled' ? 'This Hangout was cancelled. The Space is read-only.' : 'Group chat for everyone going.'}</span>
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setReportModalOpen(true)} className="hover:underline flex items-center gap-1 font-bold cursor-pointer">
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Report</span>
            </button>
            {!isHost && !closed && (
              <button type="button" onClick={() => setLeaveOpen(true)} className="hover:underline text-rose-700 flex items-center gap-1 font-bold cursor-pointer">
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Leave</span>
              </button>
            )}
          </div>
        </div>

        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 overflow-y-auto space-y-2"
          role="log"
          aria-live="polite"
          aria-label="Messages"
        >
          {loadError && (
            <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {loadError}
            </p>
          )}

          {roomMessages.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold font-heading text-[#172121]">You're early.</h2>
                <p className="text-xs text-[#3D4948] max-w-xs mx-auto">Say hi and start the conversation.</p>
              </div>
            </div>
          ) : (
            roomMessages.map((msg, i) => {
              const label = dayLabel(msg.createdAt);
              const prevLabel = i > 0 ? dayLabel(roomMessages[i - 1].createdAt) : null;
              return (
                <Fragment key={msg.id}>
                  {label && label !== prevLabel && (
                    <div className="flex items-center gap-3 py-2" aria-hidden="true">
                      <span className="flex-1 h-px bg-[#E8E6E1]" />
                      <span className="text-xs font-semibold text-[#6F6F6F]">{label}</span>
                      <span className="flex-1 h-px bg-[#E8E6E1]" />
                    </div>
                  )}
                  <ChatMessage message={msg} isOwnMessage={Boolean(currentUser?.id && msg.userId === currentUser.id)} />
                </Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 z-20 max-w-3xl w-full mx-auto">
          <ChatInput
            onSendMessage={handleSend}
            disabled={closed === 'Cancelled'}
            disabledReason={closed === 'Cancelled' ? 'Messaging closed when the host cancelled this Hangout.' : ''}
          />
        </div>
      </div>
    </PageTransition>
  );
}
