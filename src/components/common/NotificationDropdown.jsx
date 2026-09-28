import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Sparkles, CheckCheck, ChevronRight } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { authService } from '../../services/auth/authService';

export default function NotificationDropdown() {
  const {
    notifications,
    unreadCount,
    getUserById,
    markNotificationRead,
    markAllNotificationsRead,
    isAuthenticated
  } = useUser();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click (Must be called unconditionally before early returns)
  useEffect(() => {
    if (!isAuthenticated) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
    }
    setIsOpen(false);

    if (notif.type === 'vibe' && notif.actorId) {
      const actor = getUserById(notif.actorId);
      if (actor?.username) {
        navigate(`/profile/${actor.username}`);
      } else {
        authService.fetchProfiles([notif.actorId]).then(profiles => {
          if (profiles && profiles[0]?.username) {
            navigate(`/profile/${profiles[0].username}`);
          }
        }).catch(() => {});
      }
    } else if (notif.hangoutId) {
      navigate(`/hangout/${notif.hangoutId}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white text-[#171717] transition-colors border border-transparent hover:border-[#E8E6E1] cursor-pointer flex items-center justify-center"
        aria-label="Notifications"
        title="Vibe Notifications"
      >
        <Bell className="w-5 h-5 text-[#171717]" />

        {/* Subtle Unread Badge Indicator */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#18A999] rounded-full ring-2 ring-white animate-pulse" />
        )}
      </motion.button>

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#DDE3E0] rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header Bar */}
            <div className="px-5 py-4 border-b border-[#DDE3E0] flex items-center justify-between bg-[#DDF4EF]/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#18A999]" />
                <h3 className="font-extrabold font-heading text-sm text-[#172121]">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#18A999] text-white rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-xs font-semibold text-[#18A999] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#DDE3E0]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-[#6F6F6F]/40 mx-auto" />
                  <p className="text-xs font-semibold text-[#172121]">No notifications yet</p>
                  <p className="text-[11px] text-[#6F6F6F] max-w-xs mx-auto">
                    When people you vibe with host new activities, you'll be notified here!
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 cursor-pointer group ${
                      !notif.isRead ? 'bg-[#DDF4EF]/30 hover:bg-[#DDF4EF]/50' : 'bg-white hover:bg-[#EEF1EF]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#172121] font-heading truncate">
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#18A999] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#6F6F6F] leading-snug line-clamp-2">
                        {notif.message}
                      </p>
                      {notif.createdAt && (
                        <p className="text-[10px] font-medium text-[#6F6F6F]/70 pt-0.5">
                          {new Date(notif.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#6F6F6F] shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-1" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
