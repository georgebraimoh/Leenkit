import React, { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { LogOut, LogIn, ChevronDown, Wallet, ShieldAlert } from 'lucide-react';
import { HomeIcon, SparklesIcon, CalendarIcon, ShieldIcon, PersonIcon, PlusIcon } from '../common/NavIcons';
import { useUser } from '../../context/UserContext';
import NotificationDropdown from '../common/NotificationDropdown';
import leenkitIcon from '../../assets/Leenkit icon.png';
import Avatar from '../common/Avatar';
import { usePaidFeatures } from '../../hooks/usePaidFeatures';

const menuItem = 'flex items-center gap-2 px-4 py-2.5 hover:bg-[#FFF8EE] text-[#111111] font-bold transition-colors';

export default function Navbar() {
  const { paidEnabled } = usePaidFeatures();
  const { currentUser, isAuthenticated, openAuthModal, logout } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (location.pathname.endsWith('/space')) return null;

  const requireAuth = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      openAuthModal('welcome');
    }
  };

  const navLinks = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/activity', label: 'Activity', icon: SparklesIcon, onClick: requireAuth },
    { path: '/my-hangouts', label: 'Your Hangouts', icon: CalendarIcon, onClick: requireAuth },
    { path: '/safety', label: 'Safety', icon: ShieldIcon }
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#FFF8EE] border-b-2 border-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" aria-label="LEENKIT home">
          <span className="w-10 h-10 rounded-xl border-2 border-ink bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
            <img src={leenkitIcon} alt="" width="40" height="40" className="w-full h-full object-cover scale-[2.2]" />
          </span>
          <span className="font-heading font-extrabold text-2xl tracking-tight text-[#111111]">
            LEEN<span className="text-[#18A999]">KIT</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end
                onClick={item.onClick}
                className={`px-3.5 py-2 text-sm font-bold rounded-xl border-2 flex items-center gap-1.5 transition-colors ${
                  isActive ? 'bg-white border-ink shadow-xs text-[#18A999]' : 'border-transparent text-[#3D4948] hover:text-[#111111]'
                }`}
              >
                <Icon filled={isActive} className="w-[18px] h-[18px]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex md:hidden items-center gap-2">
          <NotificationDropdown />
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/create"
            onClick={requireAuth}
            className="pressable inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#18A999] text-white text-sm font-bold border-2 border-ink shadow-xs"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Host</span>
          </Link>

          <NotificationDropdown />

          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Account menu"
                aria-expanded={dropdownOpen}
                className="flex items-center gap-1.5 p-0.5 pr-2 rounded-full border-2 border-ink bg-white cursor-pointer"
              >
                <Avatar src={currentUser.avatar} name={currentUser.name} size="lg" className="w-8 h-8" />
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <m.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    onMouseLeave={() => setDropdownOpen(false)}
                    className="absolute right-0 mt-2 w-52 bg-white border-2 border-ink rounded-2xl shadow-md py-2 z-50 text-xs"
                  >
                    <div className="px-4 py-2 border-b-2 border-ink">
                      <p className="font-bold text-[#111111] truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-[#3D4948] truncate">{currentUser.email || currentUser.location}</p>
                    </div>

                    <Link
                      to={currentUser.username ? `/profile/${currentUser.username}` : '/edit-profile'}
                      onClick={() => setDropdownOpen(false)}
                      className={menuItem}
                    >
                      <PersonIcon className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>

                    {paidEnabled && (
                      <Link to="/payouts" onClick={() => setDropdownOpen(false)} className={menuItem}>
                        <Wallet className="w-4 h-4" aria-hidden="true" />
                        <span>Payouts</span>
                      </Link>
                    )}

                    {currentUser.isAdmin && (
                      <Link to="/admin" onClick={() => setDropdownOpen(false)} className={menuItem}>
                        <ShieldAlert className="w-4 h-4 text-rose-600" aria-hidden="true" />
                        <span>Admin</span>
                      </Link>
                    )}

                    <div className="border-t-2 border-ink mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                          navigate('/explore');
                        }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2.5 hover:bg-rose-50 text-rose-600 font-bold cursor-pointer transition-colors"
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="pressable inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#111111] text-sm font-bold border-2 border-ink shadow-xs cursor-pointer"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
