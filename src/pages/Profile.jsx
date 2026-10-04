import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import HangoutCard from '../components/hangout/HangoutCard';
import Button from '../components/common/Button';
import ReportModal from '../components/safety/ReportModal';
import ProfileImageViewer from '../components/common/ProfileImageViewer';
import { MapPin, Edit3, ShieldCheck, Sparkles, Calendar, LogOut, ShieldAlert, ExternalLink, Globe } from 'lucide-react';
import { InstagramIcon, TikTokIcon, SpotifyIcon } from '../components/common/SocialIcons';
import { useUser } from '../context/UserContext';
import { useLeenkit } from '../context/LeenkitContext';
import { authService } from '../services/auth/authService';
import Avatar from '../components/common/Avatar';
import { isOpenHangout, isPastHangout, sortByEventDate } from '../utils/format';

export default function Profile() {
  const { username } = useParams();
  const { users, currentUser, logout, isAuthenticated, isAuthLoading, isVibingWith, vibeWith, unvibeWith, vibingIds, getUserById, openAuthModal } = useUser();
  const { hangouts } = useLeenkit();
  const navigate = useNavigate();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
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
          <h2 className="text-xl font-bold font-heading text-[#111111]">Profile not found</h2>
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
  // Public: only open, upcoming Hangouts they host. Where someone is GOING is
  // private (shown on your own profile only).
  const hostedAll = hangouts.filter(h => h.hostId === profileUser.id && h.status !== 'cancelled');
  const hosted = sortByEventDate(hostedAll.filter(isOpenHangout));
  const attended = isOwnProfile
    ? hangouts.filter(h =>
        h.hostId !== profileUser.id &&
        (h.attendeeIds || []).includes(profileUser.id) &&
        h.status !== 'cancelled' &&
        (h.status === 'completed' || isPastHangout(h)))
    : [];
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

        {/* Profile Image Full View Modal */}
        <ProfileImageViewer
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          src={profileUser.avatar}
          alt={`${profileUser.name}'s profile picture`}
        />

        {/* Profile Card Header */}
        <div className="editorial-surface p-6 md:p-10 relative overflow-hidden bg-white shadow-xl border-2 border-ink rounded-3xl">
          <span className="accent-orb -right-8 -top-8 w-24 h-24 bg-[#18A999]/6" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {profileUser.avatar ? (
                <button
                  type="button"
                  onClick={() => setIsViewerOpen(true)}
                  aria-label={`View ${profileUser.name}'s profile picture`}
                  className="rounded-full shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]"
                >
                  <Avatar src={profileUser.avatar} name={profileUser.name} size="2xl" className="border-4 border-ink shadow-md hover:scale-105 transition-all duration-200" />
                </button>
              ) : (
                <Avatar src={null} name={profileUser.name} size="2xl" className="border-4 border-ink shadow-md" />
              )}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#111111]">
                    {profileUser.name}
                  </h1>
                </div>

                <p className="text-sm font-semibold text-[#087F73] flex items-center gap-1">
                  {profileUser.isVerifiedOrganizer && <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
                  {profileUser.isVerifiedOrganizer ? 'Verified Organizer' : profileUser.isOrganizer ? 'Host' : 'Member'}
                  {profileUser.username && <span className="text-[#6F6F6F] font-medium">· @{profileUser.username}</span>}
                </p>

                {profileUser.location && (
                  <p className="text-xs text-[#6F6F6F] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#18A999]" aria-hidden="true" /> {profileUser.location}
                  </p>
                )}

                {profileUser.bio && (
                  <p className="text-sm text-[#111111] max-w-xl leading-relaxed pt-1 break-words">
                    {profileUser.bio.replace(/Joined Qleenq/gi, 'Joined LEENKIT')}
                  </p>
                )}

                {/* Social Profiles Display */}
                {hasSocialLinks && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {profileUser.instagramUrl && (
                      <a
                        href={profileUser.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${profileUser.name}'s Instagram Profile`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF1EF] hover:bg-[#18A999]/10 text-[#111111] hover:text-[#18A999] border-2 border-ink rounded-full text-xs font-semibold transition-colors cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF1EF] hover:bg-[#18A999]/10 text-[#111111] hover:text-[#18A999] border-2 border-ink rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <TikTokIcon className="w-3.5 h-3.5 text-[#111111]" />
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
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF1EF] hover:bg-[#18A999]/10 text-[#111111] hover:text-[#18A999] border-2 border-ink rounded-full text-xs font-semibold transition-colors cursor-pointer"
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
                  onClick={async () => {
                    try {
                      await logout();
                    } finally {
                      navigate('/explore');
                    }
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
                  <span>Report</span>
                </Button>
              </div>
            )}
          </div>

          {/* Interests Badges */}
          {profileUser.interests && profileUser.interests.length > 0 && (
            <div className="pt-6 mt-6 border-t-2 border-ink flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F] mr-2">
                Interests:
              </span>
              {profileUser.interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-[#EEF1EF] text-[#111111] text-xs font-semibold rounded-full border-2 border-ink"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          <div className="pt-6 mt-6 border-t-2 border-ink grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-[#EEF1EF] rounded-2xl">
              <span className="text-2xl font-extrabold font-heading text-[#111111]">{hostedAll.length}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F] block mt-0.5">Hosted</span>
            </div>
            {isOwnProfile && (
              <div className="p-3 bg-[#EEF1EF] rounded-2xl">
                <span className="text-2xl font-extrabold font-heading text-[#111111]">{attended.length}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F] block mt-0.5">Attended</span>
              </div>
            )}
          </div>
        </div>

        {/* Who You Vibe With Section (Visible on own profile) */}
        {isOwnProfile && (
          <div className="space-y-6 pt-6 border-t-2 border-ink">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#18A999]" />
              <h2 className="text-2xl font-bold font-heading text-[#111111]">
                Who you vibe with
              </h2>
            </div>

            {vibingProfiles.length === 0 ? (
              <div className="p-6 bg-[#EEF1EF] rounded-2xl text-center space-y-2 border-2 border-ink">
                <p className="text-sm font-semibold text-[#111111]">No vibes added yet</p>
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
                    className="p-4 bg-white border-2 border-ink rounded-2xl flex items-center justify-between hover:border-ink hover:shadow-sm transition-all pressable"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={u.avatar} name={u.name} size="lg" className="border-2 border-ink" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#111111] truncate">{u.name}</p>
                        <p className="text-xs text-[#6F6F6F] truncate">{u.username ? `@${u.username}` : ''}{u.location ? ` · ${u.location}` : ''}</p>
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
              <h2 className="text-2xl font-bold font-heading text-[#111111]">
                Upcoming from {(profileUser.name || '').split(' ')[0]}
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
              <h2 className="text-2xl font-bold font-heading text-[#111111]">
                Hangouts you attended ({attended.length})
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
