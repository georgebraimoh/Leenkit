import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import HangoutCard from '../components/hangout/HangoutCard';
import Button from '../components/common/Button';
import ReportModal from '../components/safety/ReportModal';
import { MapPin, Edit3, ShieldCheck, Sparkles, Calendar, LogOut, ShieldAlert, ExternalLink, Globe } from 'lucide-react';
import { InstagramIcon, TikTokIcon, SpotifyIcon } from '../components/common/SocialIcons';
import { useUser } from '../context/UserContext';
import { useLeenkit } from '../context/LeenkitContext';
import { authService } from '../services/auth/authService';

export default function Profile() {
  const { username } = useParams();
  const { users, currentUser, logout, isAuthenticated, isAuthLoading, isVibingWith, vibeWith, unvibeWith, vibingIds, getUserById, openAuthModal } = useUser();
  const { hangouts } = useLeenkit();
  const navigate = useNavigate();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [asyncUser, setAsyncUser] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isVibeLoading, setIsVibeLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!username) {
      setAsyncUser(null);
      setIsFetchingProfile(false);
      return;
    }

    const cached = users.find(u => u.username === username);
    if (cached) {
      setAsyncUser(cached);
      setIsFetchingProfile(false);
      return;
    }

    setIsFetchingProfile(true);
    authService
      .fetchProfileByUsername(username)
      .then(p => {
        if (mounted) {
          setAsyncUser(p || null);
          setIsFetchingProfile(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setAsyncUser(null);
          setIsFetchingProfile(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [username, users]);

  // Loading guard while Supabase restores authentication session or fetches profile
  if (isAuthLoading || (username && isFetchingProfile && !asyncUser && !users.some(u => u.username === username))) {
    return (
      <PageTransition>
        <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#6F6F6F]">Loading profile...</p>
        </div>
      </PageTransition>
    );
  }

  // Find user by username parameter or fallback to current user
  const profileUser = username ? (users.find(u => u.username === username) || asyncUser) : currentUser;

  if (!profileUser) {
    return (
      <PageTransition>
        <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-4">
          <h2 className="text-xl font-bold font-heading text-[#171717]">Profile not found</h2>
          <p className="text-xs text-[#6F6F6F]">We couldn't find the requested member profile.</p>
          <Button onClick={() => navigate('/explore')}>Back to Explore</Button>
        </div>
      </PageTransition>
    );
  }

  const isOwnProfile = Boolean(currentUser?.id && profileUser.id === currentUser.id && isAuthenticated);
  const isVibing = isVibingWith(profileUser.id);

  const handleVibeToggle = async () => {
    if (!isAuthenticated) {
      openAuthModal('welcome');
      return;
    }
    setIsVibeLoading(true);
    try {
      if (isVibing) {
        await unvibeWith(profileUser.id);
      } else {
        await vibeWith(profileUser.id);
      }
    } catch (err) {
      console.error('Failed to update vibe status:', err);
    } finally {
      setIsVibeLoading(false);
    }
  };

  // Calculate activities & vibing profiles
  const hosted = hangouts.filter(h => h.hostId === profileUser.id);
  const attended = hangouts.filter(h => h.attendeeIds && h.attendeeIds.includes(profileUser.id));
  const vibingProfiles = vibingIds.map(id => getUserById(id)).filter(Boolean);

  const hasSocialLinks = Boolean(profileUser.instagramUrl || profileUser.tiktokUrl || profileUser.spotifyUrl);

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Report Member Modal */}
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="user"
          targetId={profileUser.id}
          targetTitle={profileUser.name}
        />

        {/* Profile Card Header */}
        <div className="editorial-surface p-6 md:p-10 relative overflow-hidden bg-white shadow-xl border border-[#DDE3E0] rounded-3xl">
          <span className="accent-orb -right-8 -top-8 w-24 h-24 bg-[#18A999]/6" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <img
                src={profileUser.avatar}
                alt={profileUser.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#EEF1EF] shadow-md shrink-0"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#172121]">
                    {profileUser.name}
                  </h1>
                </div>

                <p className="text-sm font-semibold text-[#18A999]">
                  {profileUser.title || "Community Member"}
                </p>

                <p className="text-xs text-[#6F6F6F] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#18A999]" /> {profileUser.location}
                </p>

                <p className="text-sm text-[#171717] max-w-xl leading-relaxed pt-1">
                  "{profileUser.bio}"
                </p>

                {/* Social Profiles Display */}
                {hasSocialLinks && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {profileUser.instagramUrl && (
                      <a
                        href={profileUser.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${profileUser.name}'s Instagram Profile`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF1EF] hover:bg-[#18A999]/10 text-[#172121] hover:text-[#18A999] border border-[#DDE3E0] rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <InstagramIcon className="w-3.5 h-3.5 text-[#18A999]" />
                        <span>Instagram</span>
                        <ExternalLink className="w-3 h-3 text-[#6F6F6F]" />
                      </a>
                    )}

                    {profileUser.tiktokUrl && (
                      <a
                        href={profileUser.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${profileUser.name}'s TikTok Profile`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF1EF] hover:bg-[#18A999]/10 text-[#172121] hover:text-[#18A999] border border-[#DDE3E0] rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <TikTokIcon className="w-3.5 h-3.5 text-[#172121]" />
                        <span>TikTok</span>
                        <ExternalLink className="w-3 h-3 text-[#6F6F6F]" />
                      </a>
                    )}

                    {profileUser.spotifyUrl && (
                      <a
                        href={profileUser.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${profileUser.name}'s Spotify Profile`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF1EF] hover:bg-[#18A999]/10 text-[#172121] hover:text-[#18A999] border border-[#DDE3E0] rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <SpotifyIcon className="w-3.5 h-3.5 text-[#1DB954]" />
                        <span>Spotify</span>
                        <ExternalLink className="w-3 h-3 text-[#6F6F6F]" />
                      </a>
                    )}
                  </div>
                )}

                {/* Empty State prompt for own profile */}
                {isOwnProfile && !hasSocialLinks && (
                  <div className="pt-2">
                    <Link
                      to="/edit-profile"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F6F6F] hover:text-[#18A999] transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#18A999]" />
                      <span>+ Add Instagram, TikTok, or Spotify to your profile</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {isOwnProfile ? (
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link to="/edit-profile">
                  <Button variant="outline" size="md" className="gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Edit profile</span>
                  </Button>
                </Link>

                <Button
                  onClick={() => {
                    logout();
                    navigate('/explore');
                  }}
                  variant="ghost"
                  size="md"
                  className="gap-2 text-rose-500 hover:bg-rose-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  onClick={handleVibeToggle}
                  disabled={isVibeLoading}
                  variant={isVibing ? "outline" : "primary"}
                  size="md"
                  className="gap-2 shadow-sm"
                >
                  {isVibeLoading ? (
                    <span>Updating...</span>
                  ) : isVibing ? (
                    <>
                      <Sparkles className="w-4 h-4 text-[#18A999] fill-[#18A999]" />
                      <span>Vibing</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Vibe</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setReportModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[#6F6F6F] hover:text-rose-600 hover:border-rose-200"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Report member</span>
                </Button>
              </div>
            )}
          </div>

          {/* Interests Badges */}
          {profileUser.interests && profileUser.interests.length > 0 && (
            <div className="pt-6 mt-6 border-t border-[#E8E6E1] flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F] mr-2">
                Interests:
              </span>
              {profileUser.interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-[#EEF1EF] text-[#172121] text-xs font-semibold rounded-full border border-[#DDE3E0]"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          {/* Clean Stats Row */}
          <div className="pt-6 mt-6 border-t border-[#E8E6E1] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-[#EEF1EF] rounded-2xl">
              <span className="text-2xl font-extrabold font-heading text-[#172121]">{hosted.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6F6F] block mt-0.5">Hosted</span>
            </div>
            <div className="p-3 bg-[#EEF1EF] rounded-2xl">
              <span className="text-2xl font-extrabold font-heading text-[#172121]">{attended.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6F6F] block mt-0.5">Attended</span>
            </div>
            <div className="p-3 bg-[#DDF4EF] rounded-2xl col-span-2">
              <span className="text-xs font-bold text-[#087F73] block">Active Member</span>
              <span className="text-[10px] text-[#087F73]/80 block mt-0.5">Joined real-life Hangouts through LEENKIT.</span>
            </div>
          </div>
        </div>

        {/* Who You Vibe With Section (Visible on own profile) */}
        {isOwnProfile && (
          <div className="space-y-6 pt-6 border-t border-[#DDE3E0]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#18A999]" />
              <h2 className="text-2xl font-bold font-heading text-[#171717]">
                Who you vibe with
              </h2>
            </div>

            {vibingProfiles.length === 0 ? (
              <div className="p-6 bg-[#EEF1EF] rounded-2xl text-center space-y-2 border border-[#DDE3E0]">
                <p className="text-sm font-semibold text-[#171717]">No vibes added yet</p>
                <p className="text-xs text-[#6F6F6F]">
                  Discover Hangouts in Explore and click <strong>Vibe</strong> on members you connect with!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {vibingProfiles.map(u => (
                  <Link
                    key={u.id}
                    to={`/profile/${u.username}`}
                    className="p-4 bg-white border border-[#E8E6E1] rounded-2xl flex items-center justify-between hover:border-[#D6D2C9] hover:shadow-sm transition-all pressable"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-12 h-12 rounded-full object-cover shrink-0 border border-[#E8E6E1]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#171717] truncate">{u.name}</p>
                        <p className="text-xs text-[#6F6F6F] truncate">@{u.username} · {u.location}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-[#DDF4EF] text-[#087F73] text-[10px] font-extrabold uppercase rounded-full border border-[#18A999]/30 shrink-0 ml-2">
                      Vibing
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hosted Activities Section */}
        {hosted.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#18A999]" />
              <h2 className="text-2xl font-bold font-heading text-[#171717]">
                Hosted by {profileUser.name.split(' ')[0]}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hosted.map(hangout => (
                <HangoutCard key={hangout.id} hangout={hangout} />
              ))}
            </div>
          </div>
        )}

        {/* Attended Activities Section */}
        {attended.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#18A999]" />
              <h2 className="text-2xl font-bold font-heading text-[#171717]">
                Hangouts Attended ({attended.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attended.map(hangout => (
                <HangoutCard key={hangout.id} hangout={hangout} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
