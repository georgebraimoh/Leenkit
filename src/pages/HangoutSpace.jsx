import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import SpaceHeader from '../components/space/SpaceHeader';
import ChatMessage from '../components/space/ChatMessage';
import ChatInput from '../components/space/ChatInput';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import ConfirmModal from '../components/common/ConfirmModal';
import ReportModal from '../components/safety/ReportModal';
import { Lock, ShieldAlert, AlertTriangle, MessageCircle } from 'lucide-react';
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

// Consecutive user messages from the same person on the same day.
function sameGroup(a, b) {
  return Boolean(a && b && a.type !== 'system' && b.type !== 'system'
    && a.userId === b.userId && dayLabel(a.createdAt) === dayLabel(b.createdAt));
}

// Full screen on phones; a phone-sized chat window on larger screens.
function PhoneFrame({ children }) {
  return (
    <div className="min-h-[100dvh] bg-[#FFF8EE] md:flex md:items-center md:justify-center md:py-6">
      <div className="flex flex-col h-[100dvh] md:h-[min(860px,calc(100dvh-3rem))] w-full md:max-w-[420px] bg-white md:border-2 md:border-ink md:rounded-[2rem] md:shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
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
  const [loadedFor, setLoadedFor] = useState(null);
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
  const messagesLoading = attending && loadedFor !== id && roomMessages.length === 0;

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
    loadSpaceMessages(id)
      .catch(() => setLoadError('Could not load messages. Check your connection.'))
      .finally(() => setLoadedFor(id));
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
        <Loader label="Opening chat" className="min-h-[70vh]" />
      </PageTransition>
    );
  }

  if (!hangout) {
    return (
      <PageTransition key="space-not-found">
        <div className="max-w-md mx-auto p-10 text-center space-y-4 my-10">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold font-heading text-[#111111]">Hangout not found</h1>
          <Button onClick={() => navigate('/explore')}>Back to Explore</Button>
        </div>
      </PageTransition>
    );
  }

  if (!attending) {
    return (
      <PageTransition key="space-locked">
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white border-2 border-ink rounded-3xl p-8 text-center space-y-5 shadow-md">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD166] border-2 border-ink flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold font-heading text-[#111111]">Members only</h1>
              <p className="text-sm text-[#3D4948]">
                {hangout.isPaid ? 'Get a ticket to join the chat.' : 'Join the Hangout to join the chat.'}
              </p>
            </div>
            {!isAuthenticated ? (
              <Button onClick={() => openAuthModal('welcome')} variant="primary" size="lg" fullWidth>
                Sign in
              </Button>
            ) : (
              <Button onClick={() => navigate(`/hangout/${hangout.id}`)} variant="primary" size="lg" fullWidth showArrow>
                {closed ? 'View Hangout' : hangout.isPaid ? 'Get a ticket' : 'Join'}
              </Button>
            )}
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

      <PhoneFrame>
        <SpaceHeader
          hangout={hangout}
          onReport={() => setReportModalOpen(true)}
          onLeave={!isHost && !closed ? () => setLeaveOpen(true) : undefined}
        />

        {closed === 'Cancelled' && (
          <p className="bg-[#FFD166] border-b-2 border-ink px-4 py-2 text-xs font-bold text-[#111111] shrink-0">
            Cancelled. This chat is read-only.
          </p>
        )}

        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto chat-wallpaper px-3 py-3"
          role="log"
          aria-live="polite"
          aria-label="Messages"
        >
          {loadError && (
            <p role="alert" className="p-3 mb-2 bg-rose-50 border-2 border-ink rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {loadError}
            </p>
          )}

          {messagesLoading ? (
            <Loader label="Loading messages" className="h-full" />
          ) : roomMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-6">
              <span className="w-12 h-12 rounded-2xl bg-[#FFD166] border-2 border-ink flex items-center justify-center">
                <MessageCircle className="w-6 h-6" aria-hidden="true" />
              </span>
              <p className="font-heading font-extrabold text-base text-[#111111]">No messages yet</p>
              <p className="text-xs text-[#3D4948]">Say hi to the group.</p>
            </div>
          ) : (
            roomMessages.map((msg, i) => {
              const label = dayLabel(msg.createdAt);
              const prev = roomMessages[i - 1];
              const next = roomMessages[i + 1];
              const prevLabel = prev ? dayLabel(prev.createdAt) : null;
              return (
                <Fragment key={msg.id}>
                  {label && label !== prevLabel && (
                    <div className="flex justify-center my-3" aria-hidden="true">
                      <span className="px-3 py-1 text-[11px] font-bold bg-white text-[#111111] rounded-lg border-2 border-ink">{label}</span>
                    </div>
                  )}
                  <ChatMessage
                    message={msg}
                    isOwnMessage={Boolean(currentUser?.id && msg.userId === currentUser.id)}
                    isFirstInGroup={!sameGroup(prev, msg)}
                    isLastInGroup={!sameGroup(msg, next)}
                  />
                </Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSendMessage={handleSend}
          disabled={closed === 'Cancelled'}
          disabledReason={closed === 'Cancelled' ? 'Messaging closed when the host cancelled this Hangout.' : ''}
        />
      </PhoneFrame>
    </PageTransition>
  );
}
