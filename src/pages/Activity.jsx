import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MessageSquare,
  UserPlus,
  Bell,
  CheckCheck,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ActivityCard from '../components/activity/ActivityCard';
import { useUser } from '../context/UserContext';

export default function Activity() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAllNotificationsRead,
    isAuthLoading,
    isAuthenticated,
    openAuthModal
  } = useUser();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'messages' | 'joins' | 'vibes'
  const [hasError, setHasError] = useState(false);

  // Filter notifications list by tab selection
  const filteredNotifications = useMemo(() => {
    if (!Array.isArray(notifications)) return [];
    if (activeFilter === 'messages') {
      return notifications.filter(n => n.type === 'space_message');
    }
    if (activeFilter === 'joins') {
      return notifications.filter(n => n.type === 'hangout_join');
    }
    if (activeFilter === 'vibes') {
      return notifications.filter(n => n.type === 'vibe' || n.type === 'vibe_hangout');
    }
    return notifications;
  }, [notifications, activeFilter]);

  // Auth Guard
  if (isAuthLoading) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#6F6F6F]">Loading your Activity feed...</p>
        </div>
      </PageTransition>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-heading text-[#111111]">Activity</h2>
            <p className="text-sm text-[#6F6F6F]">
              Sign in to see who joins and chats.
            </p>
          </div>
          <Button onClick={() => openAuthModal('login')} variant="primary" size="lg" fullWidth>
            Sign In to View Activity
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
            <h2 className="text-2xl font-bold font-heading text-[#111111]">We couldn't load your Activity.</h2>
            <p className="text-sm text-[#6F6F6F]">
              Could not load your activity. Try again.
            </p>
          </div>
          <Button
            onClick={() => {
              setHasError(false);
              window.location.reload();
            }}
            variant="outline"
            size="md"
            className="gap-2 mx-auto"
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#DDF4EF] text-[#18A999] rounded-full">
                Social Feed
              </span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#18A999] text-white rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[#111111] tracking-tight">
              Activity
            </h1>
            <p className="text-sm text-[#6F6F6F]">
              Updates from your Hangouts.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-ink hover:border-[#18A999] text-[#18A999] text-xs font-bold rounded-full shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <CheckCheck className="w-4 h-4 text-[#18A999]" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 border-b-2 border-ink pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'text-[#6F6F6F] hover:text-[#111111] hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>All ({notifications.length})</span>
            </button>

            <button
              onClick={() => setActiveFilter('messages')}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'messages'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'text-[#6F6F6F] hover:text-[#111111] hover:bg-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Messages ({notifications.filter(n => n.type === 'space_message').length})</span>
            </button>

            <button
              onClick={() => setActiveFilter('joins')}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'joins'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'text-[#6F6F6F] hover:text-[#111111] hover:bg-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Joins ({notifications.filter(n => n.type === 'hangout_join').length})</span>
            </button>

            <button
              onClick={() => setActiveFilter('vibes')}
              className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeFilter === 'vibes'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'text-[#6F6F6F] hover:text-[#111111] hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vibes ({notifications.filter(n => n.type === 'vibe' || n.type === 'vibe_hangout').length})</span>
            </button>
          </div>
        )}

        {/* Notifications Feed List */}
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nothing happening yet"
            description="Joins and messages show up here."
            actionLabel="Explore Hangouts"
            onAction={() => navigate('/explore')}
          />
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notif) => (
              <ActivityCard key={notif.id} notification={notif} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
