import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import { ArrowLeft, CheckCircle, AlertCircle, Upload, X } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { authService } from '../services/auth/authService';
import { LOCATIONS } from '../data/locations';

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
    interests: currentUser?.interests || []
  });

  const [customAvatarFile, setCustomAvatarFile] = useState(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');

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
    setIsSaving(true);
    setSavingState('');

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
        ...formData,
        avatar: finalAvatarUrl
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
