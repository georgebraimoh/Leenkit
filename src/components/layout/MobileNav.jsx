import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import Avatar from '../common/Avatar';
import { HomeIcon, SparklesIcon, CalendarIcon, PersonIcon, PlusIcon } from '../common/NavIcons';

// iOS-style tab bar: icon over a small label; the active tab uses the
// filled icon and the brand colour.
const tabClass = (active) =>
  `flex flex-col items-center gap-0.5 min-w-[56px] py-0.5 text-[10px] font-semibold transition-colors ${
    active ? 'text-[#18A999]' : 'text-[#6F6F6F]'
  }`;

export default function MobileNav() {
  const { currentUser } = useUser();
  const location = useLocation();

  if (location.pathname.endsWith('/space')) return null;

  const profilePath = currentUser?.username
    ? `/profile/${currentUser.username}`
    : currentUser ? '/edit-profile' : '/login';
  const onProfile = location.pathname.startsWith('/profile');

  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-ink px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end justify-around">
        <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
          {({ isActive }) => (
            <>
              <span className={isActive ? 'animate-tab-pop' : ''}><HomeIcon filled={isActive} /></span>
              <span>Home</span>
            </>
          )}
        </NavLink>

        <NavLink to="/activity" className={({ isActive }) => tabClass(isActive)}>
          {({ isActive }) => (
            <>
              <span className={isActive ? 'animate-tab-pop' : ''}><SparklesIcon filled={isActive} /></span>
              <span>Activity</span>
            </>
          )}
        </NavLink>

        <NavLink to="/create" aria-label="Host a Hangout" className="-mt-6 flex flex-col items-center">
          <span className="pressable w-14 h-14 rounded-2xl bg-[#18A999] text-white border-2 border-ink shadow-sm flex items-center justify-center">
            <PlusIcon className="w-7 h-7" />
          </span>
        </NavLink>

        <NavLink to="/my-hangouts" className={({ isActive }) => tabClass(isActive)}>
          {({ isActive }) => (
            <>
              <span className={isActive ? 'animate-tab-pop' : ''}><CalendarIcon filled={isActive} /></span>
              <span>Hangouts</span>
            </>
          )}
        </NavLink>

        <NavLink to={profilePath} className={() => tabClass(onProfile)}>
          {currentUser ? (
            <Avatar
              src={currentUser.avatar}
              name={currentUser.name}
              size="xs"
              className={`w-6 h-6 ${onProfile ? 'ring-2 ring-[#18A999]' : ''}`}
            />
          ) : (
            <PersonIcon filled={onProfile} />
          )}
          <span>Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
