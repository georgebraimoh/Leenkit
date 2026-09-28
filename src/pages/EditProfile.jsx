import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import { ArrowLeft, CheckCircle, AlertCircle, Upload, X, Globe } from 'lucide-react';
import { InstagramIcon, TikTokIcon, SpotifyIcon } from '../components/common/SocialIcons';
import { useUser } from '../context/UserContext';
import { authService } from '../services/auth/authService';
import { validateAllSocialUrls } from '../utils/socialUrlValidator';

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
];

const INTEREST_OPTIONS = [
  "Tech", "Music", "Photography", "Football", "Coffee", "Creative", "Food",
  "Design", "Fitness", "Gaming", "Outdoors", "Sports", "Art", "Movies"
];

export default function EditProfile() {
  const navigate = useNavigate();
  const { currentUser, updateProfile } = useUser();

  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    title: currentUser?.title || '',
    location: currentUser?.location || 'Wuse 2, Abuja',
    bio: currentUser?.bio || '',
    avatar: currentUser?.avatar || AVATAR_PRESETS[0],
    interests: currentUser?.interests || [],
    instagramUrl: currentUser?.instagramUrl || '',
    tiktokUrl: currentUser?.tiktokUrl || '',
    spotifyUrl: currentUser?.spotifyUrl || ''
  });

  const [customAvatarFile, setCustomAvatarFile] = useState(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');

  const [socialErrors, setSocialErrors] = useState({
    instagramUrl: '',
    tiktokUrl: '',
    spotifyUrl: ''
  });

  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingState, setSavingState] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB limit
    if (file.size > MAX_SIZE) {
      setAvatarError('Selected image exceeds the 5 MB size limit.');
      e.target.value = '';
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setAvatarError('Unsupported image format. Please select a JPG, PNG, or WEBP image.');
      e.target.value = '';
      return;
    }

    setCustomAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setCustomAvatarPreview(previewUrl);
  };

  const handleClearCustomAvatar = () => {
    setCustomAvatarFile(null);
    if (customAvatarPreview) {
      URL.revokeObjectURL(customAvatarPreview);
    }
    setCustomAvatarPreview(null);
    setAvatarError('');
  };

  const toggleInterest = (interest) => {
    setFormData(prev => {
      const exists = prev.interests.includes(interest);
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter(i => i !== interest)
          : [...prev.interests, interest]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaved(false);
    setSaveError('');
    setSocialErrors({ instagramUrl: '', tiktokUrl: '', spotifyUrl: '' });
    setIsSaving(true);
    setSavingState('');

    // Step 4 URL Validation & Security Check
    const socialValidation = validateAllSocialUrls({
      instagramUrl: formData.instagramUrl,
      tiktokUrl: formData.tiktokUrl,
      spotifyUrl: formData.spotifyUrl
    });

    if (!socialValidation.isValid) {
      setSocialErrors(socialValidation.errors);
      setSaveError('Please check your social profile links for validation errors.');
      setIsSaving(false);
      return;
    }

    let finalAvatarUrl = formData.avatar;

    try {
      if (customAvatarFile) {
        setSavingState('Uploading profile picture...');
        const publicUrl = await authService.uploadAvatarImage(currentUser?.id, customAvatarFile);
        if (publicUrl) {
          finalAvatarUrl = publicUrl;
        }
      }

      setSavingState('Saving profile changes...');
      const updated = await updateProfile({
        name: formData.name,
        title: formData.title,
        location: formData.location,
        bio: formData.bio,
        avatar: finalAvatarUrl,
        interests: formData.interests,
        instagram_url: socialValidation.normalized.instagram_url,
        tiktok_url: socialValidation.normalized.tiktok_url,
        spotify_url: socialValidation.normalized.spotify_url
      });

      setSaved(true);
      setTimeout(() => {
        navigate(`/profile/${updated?.username || currentUser?.username}`);
      }, 600);
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
      setSavingState('');
    }
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#6F6F6F] hover:text-[#171717] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to profile</span>
        </button>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Account Settings</span>
          <h1 className="text-3xl font-extrabold font-heading text-[#172121]">
            Edit Profile
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Avatar Selector & Custom Upload */}
          <FormField label="Profile Picture" helpText="Select a preset avatar or upload a custom photo from your device (JPG, PNG, WEBP max 5 MB).">
            <div className="space-y-4 pt-1">
              {/* Active Avatar Preview & Device Upload Button */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#18A999] shadow-sm shrink-0">
                  <img
                    src={customAvatarPreview || formData.avatar}
                    alt="Current avatar preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-1">
                  <label className="px-3.5 py-2 bg-[#EEF1EF] border border-[#DDE3E0] hover:border-[#18A999] hover:text-[#18A999] rounded-xl text-xs font-semibold text-[#172121] inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-[#18A999]" />
                    <span>Upload photo from device</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {customAvatarFile && (
                    <button
                      type="button"
                      onClick={handleClearCustomAvatar}
                      className="block text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Remove custom photo
                    </button>
                  )}
                </div>
              </div>

              {/* Avatar Error Alert */}
              {avatarError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600">
                  {avatarError}
                </div>
              )}

              {/* Presets Row */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#6F6F6F]">Or select a preset avatar:</p>
                <div className="flex items-center gap-3">
                  {AVATAR_PRESETS.map((url, idx) => {
                    const isSelected = !customAvatarFile && formData.avatar === url;
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          handleClearCustomAvatar();
                          setFormData({ ...formData, avatar: url });
                        }}
                        className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected ? 'border-[#18A999] ring-2 ring-[#18A999]/30 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="Avatar option" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </FormField>

          {/* Name & Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Full Name" required>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
              />
            </FormField>

            <FormField label="Headline / Title">
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Web Developer, Architect..."
                className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
              />
            </FormField>
          </div>

          {/* Location */}
          <FormField label="Location in Abuja">
            <input
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Wuse 2, Abuja"
              className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
            />
          </FormField>

          {/* Bio */}
          <FormField label="Short Bio" helpText="Keep it friendly and concise.">
            <textarea
              rows="3"
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
            />
          </FormField>

          {/* Interests */}
          <FormField label="Your Interests">
            <div className="flex flex-wrap gap-2 pt-2">
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = formData.interests.includes(interest);
                return (
                  <button
                    type="button"
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#18A999] text-white shadow-xs'
                        : 'bg-[#EEF1EF] text-[#3D4948] border border-[#DDE3E0] hover:text-[#172121]'
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* Social Profiles Section */}
          <div className="pt-6 border-t border-[#E8E6E1] space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold font-heading text-[#172121] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#18A999]" />
                <span>Social Profiles</span>
              </h3>
              <p className="text-xs text-[#6F6F6F]">
                Connect your public social profiles so other members can find you on Instagram, TikTok, or Spotify. All social links are optional.
              </p>
            </div>

            <div className="space-y-4">
              {/* Instagram URL */}
              <FormField label="Instagram Profile URL" helpText="e.g. https://www.instagram.com/your_username">
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#18A999]">
                    <InstagramIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    value={formData.instagramUrl}
                    onChange={e => {
                      setFormData({ ...formData, instagramUrl: e.target.value });
                      if (socialErrors.instagramUrl) setSocialErrors({ ...socialErrors, instagramUrl: '' });
                    }}
                    placeholder="https://www.instagram.com/username"
                    className={`w-full pl-10 pr-10 py-3 bg-[#EEF1EF] border rounded-2xl text-sm focus:outline-none focus:bg-white ${
                      socialErrors.instagramUrl ? 'border-rose-400 focus:border-rose-500' : 'border-[#DDE3E0] focus:border-[#18A999]'
                    }`}
                  />
                  {formData.instagramUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, instagramUrl: '' })}
                      className="absolute right-3 text-[#6F6F6F] hover:text-[#172121] cursor-pointer"
                      title="Clear Instagram URL"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {socialErrors.instagramUrl && (
                  <p className="text-xs text-rose-500 font-medium pt-1">{socialErrors.instagramUrl}</p>
                )}
              </FormField>

              {/* TikTok URL */}
              <FormField label="TikTok Profile URL" helpText="e.g. https://www.tiktok.com/@your_username">
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#172121]">
                    <TikTokIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    value={formData.tiktokUrl}
                    onChange={e => {
                      setFormData({ ...formData, tiktokUrl: e.target.value });
                      if (socialErrors.tiktokUrl) setSocialErrors({ ...socialErrors, tiktokUrl: '' });
                    }}
                    placeholder="https://www.tiktok.com/@username"
                    className={`w-full pl-10 pr-10 py-3 bg-[#EEF1EF] border rounded-2xl text-sm focus:outline-none focus:bg-white ${
                      socialErrors.tiktokUrl ? 'border-rose-400 focus:border-rose-500' : 'border-[#DDE3E0] focus:border-[#18A999]'
                    }`}
                  />
                  {formData.tiktokUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tiktokUrl: '' })}
                      className="absolute right-3 text-[#6F6F6F] hover:text-[#172121] cursor-pointer"
                      title="Clear TikTok URL"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {socialErrors.tiktokUrl && (
                  <p className="text-xs text-rose-500 font-medium pt-1">{socialErrors.tiktokUrl}</p>
                )}
              </FormField>

              {/* Spotify URL */}
              <FormField label="Spotify Profile URL" helpText="e.g. https://open.spotify.com/user/your_profile_id">
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#1DB954]">
                    <SpotifyIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    value={formData.spotifyUrl}
                    onChange={e => {
                      setFormData({ ...formData, spotifyUrl: e.target.value });
                      if (socialErrors.spotifyUrl) setSocialErrors({ ...socialErrors, spotifyUrl: '' });
                    }}
                    placeholder="https://open.spotify.com/user/profile_id"
                    className={`w-full pl-10 pr-10 py-3 bg-[#EEF1EF] border rounded-2xl text-sm focus:outline-none focus:bg-white ${
                      socialErrors.spotifyUrl ? 'border-rose-400 focus:border-rose-500' : 'border-[#DDE3E0] focus:border-[#18A999]'
                    }`}
                  />
                  {formData.spotifyUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, spotifyUrl: '' })}
                      className="absolute right-3 text-[#6F6F6F] hover:text-[#172121] cursor-pointer"
                      title="Clear Spotify URL"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {socialErrors.spotifyUrl && (
                  <p className="text-xs text-rose-500 font-medium pt-1">{socialErrors.spotifyUrl}</p>
                )}
              </FormField>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-[#E8E6E1] flex items-center justify-between">
            {saved ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Profile updated successfully!
              </span>
            ) : <span />}

            <Button type="submit" variant="primary" size="md" disabled={isSaving}>
              {isSaving ? (savingState || 'Saving...') : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
