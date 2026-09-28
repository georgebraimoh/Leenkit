import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import SpaceHeader from '../components/space/SpaceHeader';
import ChatMessage from '../components/space/ChatMessage';
import ChatInput from '../components/space/ChatInput';
import Button from '../components/common/Button';
import ReportModal from '../components/safety/ReportModal';
import { Lock, Sparkles, ShieldAlert, LogOut } from 'lucide-react';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';

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
    joinHangout,
    leaveHangout
  } = useLeenkit();
  const { currentUser, isAuthLoading } = useUser();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  const hangout = (isAuthLoading || isHangoutsLoading) ? null : getHangoutById(id);
  const roomMessages = (id && messagesMap[id]) ? messagesMap[id] : [];
  const attending = hangout ? isAttending(hangout.id) : false;

  // Subscribe to space realtime messages
  useEffect(() => {
    if (!id || !attending || isAuthLoading || isHangoutsLoading) return;

    loadSpaceMessages(id);
    const unsubscribe = subscribeToSpaceMessages(id);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id, attending, isAuthLoading, isHangoutsLoading]);

  // Handle scroll position tracking
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // Consider near bottom if within 150px of the bottom
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  };

  // Auto-scroll when new messages arrive if user is near bottom
  useEffect(() => {
    if (isAuthLoading || isHangoutsLoading) return;
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomMessages.length, isAuthLoading, isHangoutsLoading]);

  // Loading state guard
  if (isAuthLoading || isHangoutsLoading) {
    return (
      <PageTransition key="space-loading">
        <div className="max-w-md mx-auto p-10 text-center space-y-4 my-10">
          <div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#3D4948]">Connecting to LEENKIT Space...</p>
        </div>
      </PageTransition>
    );
  }

  // Not found state guard
  if (!hangout) {
    return (
      <PageTransition key="space-not-found">
        <div className="max-w-md mx-auto p-10 text-center space-y-4 my-10">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold font-heading text-[#172121]">Hangout not found</h2>
          <Button onClick={() => navigate('/explore')}>Return to Explore</Button>
        </div>
      </PageTransition>
    );
  }

  // Locked access guard for non-attendees
  if (!attending) {
    return (
      <PageTransition key="space-locked">
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#DDE3E0] rounded-3xl p-8 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">
                LEENKIT Space Access
              </span>
              <h2 className="text-2xl font-bold font-heading text-[#172121]">
                Attendees Only
              </h2>
              <p className="text-sm text-[#3D4948] leading-relaxed">
                The LEENKIT Space for <strong className="text-[#172121]">"{hangout.title}"</strong> is exclusive to confirmed attendees. Join the Hangout to communicate with attendees.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={() => {
                  joinHangout(hangout.id);
                }}
                variant="primary"
                size="lg"
                fullWidth
                showArrow
              >
                Join Hangout now
              </Button>

              <button
                onClick={() => navigate(`/hangout/${hangout.id}`)}
                className="text-xs font-semibold text-[#3D4948] hover:text-[#172121] block mx-auto pt-2 cursor-pointer"
              >
                View Hangout details
              </button>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  const handleSend = async (text) => {
    try {
      // Always auto-scroll to bottom when sending a new message
      isNearBottomRef.current = true;
      await sendMessage(hangout.id, text);
    } catch (err) {
      console.error('Failed to send space message:', err);
    }
  };

  const handleLeaveActivity = () => {
    if (window.confirm("Are you sure you want to leave this Hangout? You will lose access to the LEENKIT Space.")) {
      leaveHangout(hangout.id);
      navigate('/explore');
    }
  };

  return (
    <PageTransition key="space-content">
      <div className="min-h-screen flex flex-col bg-[#F7F5EF]">
        {/* Safety Report Modal */}
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="space"
          targetId={hangout.id}
          targetTitle={hangout.title}
        />

        {/* Space Header */}
        <SpaceHeader hangout={hangout} />

        {/* Space Context Banner & Actions */}
        <div className="bg-[#DDF4EF] border-b border-[#DDE3E0] px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-[#087F73] font-medium gap-2">
          <span>💬 Temporary LEENKIT Space for attendees of this Hangout.</span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setReportModalOpen(true)}
              className="hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>

            {currentUser?.id && hangout.hostId !== currentUser.id && (
              <button
                onClick={handleLeaveActivity}
                className="hover:underline text-rose-600 flex items-center gap-1 font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages Feed Container */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 overflow-y-auto space-y-2"
        >
          {roomMessages.length === 0 ? (
            /* LEENKIT Intentional Empty State */
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold font-heading text-[#172121]">You're early.</h3>
                <p className="text-xs text-[#3D4948] max-w-xs mx-auto">
                  Say something and start the conversation with other attendees!
                </p>
              </div>
            </div>
          ) : (
            roomMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isOwnMessage={Boolean(currentUser?.id && msg.userId === currentUser.id)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Message Input Bar */}
        <div className="sticky bottom-0 z-20 max-w-3xl w-full mx-auto shadow-lg">
          <ChatInput onSendMessage={handleSend} />
        </div>
      </div>
    </PageTransition>
  );
}
