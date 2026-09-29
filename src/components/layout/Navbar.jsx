import React, { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Calendar, Plus, User, LogOut, LogIn, ChevronDown, MapPin, Navigation, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useLocationContext } from '../../context/LocationContext';
import Button from '../common/Button';
import NotificationDropdown from '../common/NotificationDropdown';
import leenkitIcon from '../../assets/Leenkit icon.png';

export default function Navbar() {
  const { currentUser, isAuthenticated, openAuthModal, logout } = useUser();
  const { activeSearchLocation, userLocation } = useLocationContext();
  const location = useLocation();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isSpacePage = location.pathname.endsWith('/space');
  if (isSpacePage) return null;

  const handleCreateClick = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      openAuthModal('welcome');
    }
  };

  const handleMyHangoutsClick = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      openAuthModal('welcome');
    }
  };

  const handleLocationClick = () => {
    if (location.pathname !== '/explore') {
      navigate('/explore');
    }
  };

  const activePlaceName = activeSearchLocation?.placeName || userLocation?.placeName || 'Anywhere';

  const handleActivityClick = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      openAuthModal('welcome');
    }
  };

  const navLinks = [
    { path: '/explore', label: 'Explore', icon: Compass },
    { path: '/activity', label: 'Activity', icon: Sparkles, onClick: handleActivityClick },
    { path: '/my-hangouts', label: 'Your Hangouts', icon: Calendar, onClick: handleMyHangoutsClick },
    { path: '/safety', label: 'Safety', icon: ShieldCheck }
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#F7F5EF]/90 backdrop-blur-md border-b border-[#DDE3E0] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo & Active Location Indicator */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-md shadow-black/10 border border-[#DDE3E0] bg-white overflow-hidden flex items-center justify-center flex-shrink-0"
            >
              <img
                src={leenkitIcon}
                alt="LEENKIT Logo Icon"
                className="w-full h-full object-cover scale-[2.2] transition-transform duration-200"
              />
            </motion.div>
            <div>
              <span className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-[#172121]">
                LEEN<span className="text-[#18A999]">KIT</span>
              </span>
            </div>
          </Link>

          {/* Active Location Indicator */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleLocationClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#EEF1EF] border border-[#DDE3E0] text-[#172121] font-bold rounded-full text-xs shadow-xs cursor-pointer transition-transform"
            title="Location Discovery"
          >
            <MapPin className="w-3.5 h-3.5 text-[#18A999]" />
            <span className="max-w-[140px] truncate">{activePlaceName}</span>
          </motion.button>
        </div>

        {/* Desktop Nav Links with Animated Active Indicator */}
        <nav className="hidden md:flex items-center gap-2 relative">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={item.onClick}
                className={`relative px-4 py-2 text-sm font-bold transition-colors flex items-center gap-1.5 z-10 ${
                  isActive ? 'text-[#18A999]' : 'text-[#3D4948] hover:text-[#172121]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="navbarActiveIndicator"
                    className="absolute inset-0 bg-[#18A999]/10 rounded-full -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile Notification Bell & Action Controls */}
        <div className="flex md:hidden items-center gap-2">
          <NotificationDropdown />
        </div>

        {/* Desktop Action & User Auth State */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/create" onClick={handleCreateClick}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
              <Button variant="primary" size="md" className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" />
                <span>Host a Hangout</span>
              </Button>
            </motion.div>
          </Link>

          <NotificationDropdown />

          {isAuthenticated ? (
            /* User Dropdown Menu */
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-white transition-colors border border-transparent hover:border-[#DDE3E0] cursor-pointer"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full object-cover border border-[#DDE3E0] shadow-xs"
                />
                <ChevronDown className={`w-3.5 h-3.5 text-[#3D4948] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onMouseLeave={() => setDropdownOpen(false)}
                    className="absolute right-0 mt-2 w-48 bg-white border border-[#DDE3E0] rounded-2xl shadow-xl py-2 z-50 text-xs"
                  >
                    <div className="px-4 py-2 border-b border-[#DDE3E0]">
                      <p className="font-bold text-[#172121] truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-[#3D4948] truncate">{currentUser.email || currentUser.location}</p>
                    </div>

                    <Link
                      to={`/profile/${currentUser.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-[#DDF4EF]/50 text-[#172121] font-semibold transition-colors"
                    >
                      <User className="w-4 h-4 text-[#18A999]" />
                      <span>My Profile</span>
                    </Link>

                    <Link
                      to="/safety"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-[#DDF4EF]/50 text-[#172121] font-semibold transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#087F73]" />
                      <span>Safety & Trust</span>
                    </Link>

                    <div className="border-t border-[#E8E6E1] mt-1 pt-1">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                          navigate('/explore');
                        }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2.5 hover:bg-rose-50 text-rose-600 font-semibold cursor-pointer transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Sign In Button for Guests */
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
              <Button
                onClick={() => openAuthModal('login')}
                variant="outline"
                size="md"
                className="gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
