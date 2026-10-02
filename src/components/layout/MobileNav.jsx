import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Calendar, Plus, User, Sparkles } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import Avatar from '../common/Avatar';

export default function MobileNav() {
  const { currentUser } = useUser();
  const location = useLocation();

  const isSpacePage = location.pathname.endsWith('/space');
  if (isSpacePage) return null;

  const profilePath = currentUser?.username
    ? `/profile/${currentUser.username}`
    : currentUser ? '/edit-profile' : '/login';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#DDE3E0] px-4 py-2 shadow-lg">
      <div className="flex items-center justify-around">
        <NavLink
          to="/explore"
          className="flex flex-col items-center gap-1 relative"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.92 }}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#18A999]' : 'text-[#3D4948]'
              }`}
            >
              <Compass className="w-5 h-5" />
              <span>Explore</span>

              {isActive && (
                <motion.div
                  layoutId="mobileActiveDot"
                  className="w-1.5 h-1.5 rounded-full bg-[#18A999] absolute -bottom-1"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.div>
          )}
        </NavLink>

        <NavLink
          to="/activity"
          className="flex flex-col items-center gap-1 relative"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.92 }}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#18A999]' : 'text-[#3D4948]'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>Activity</span>

              {isActive && (
                <motion.div
                  layoutId="mobileActiveDot"
                  className="w-1.5 h-1.5 rounded-full bg-[#18A999] absolute -bottom-1"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.div>
          )}
        </NavLink>

        <NavLink
          to="/my-hangouts"
          className="flex flex-col items-center gap-1 relative"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.92 }}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#18A999]' : 'text-[#3D4948]'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span>Hangouts</span>

              {isActive && (
                <motion.div
                  layoutId="mobileActiveDot"
                  className="w-1.5 h-1.5 rounded-full bg-[#18A999] absolute -bottom-1"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.div>
          )}
        </NavLink>

        {/* Floating Create Button */}
        <NavLink
          to="/create"
          className="flex flex-col items-center justify-center -mt-6"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="w-12 h-12 rounded-full bg-[#18A999] text-white flex items-center justify-center shadow-lg shadow-[#18A999]/30 border-2 border-white"
          >
            <Plus className="w-6 h-6" />
          </motion.div>

          <span className="text-[10px] font-semibold text-[#172121] mt-0.5">
            Host
          </span>
        </NavLink>

        <NavLink
          to={profilePath}
          className="flex flex-col items-center gap-1 relative"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.92 }}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#18A999]' : 'text-[#3D4948]'
              }`}
            >
              {currentUser ? (
                <Avatar
                  src={currentUser.avatar}
                  name={currentUser.name}
                  size="xs"
                  className={`border ${location.pathname.startsWith('/profile') ? 'border-[#18A999] ring-2 ring-[#18A999]/20' : 'border-stone-300'}`}
                />
              ) : (
                <User className="w-5 h-5" />
              )}

              <span>Profile</span>

              {location.pathname.startsWith('/profile') && (
                <motion.div
                  layoutId="mobileActiveDot"
                  className="w-1.5 h-1.5 rounded-full bg-[#18A999] absolute -bottom-1"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.div>
          )}
        </NavLink>
      </div>
    </div>
  );
}