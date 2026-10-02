import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import Avatar from '../components/common/Avatar';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/common/Toast';
import { CATEGORIES } from '../data/categories';

const INTEREST_TAGS = CATEGORIES.filter(c => c.id !== 'all').map(c => c.label);

export default function Onboarding() {
  const navigate = useNavigate();
  const { currentUser, updateProfile, isAuthLoading, openAuthModal } = useUser();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Seed from the profile once it has loaded.
  useEffect(() => {
    if (!currentUser) return;
    setLocation(currentUser.location || '');
    setSelectedInterests(Array.isArray(currentUser.interests) ? currentUser.interests : []);
    const defaultBio = (currentUser.bio || '').startsWith('Joined LEENKIT') || (currentUser.bio || '').startsWith('Joined Qleenq');
    setBio(defaultBio ? '' : (currentUser.bio || ''));
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isAuthLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center" aria-busy="true">
        <div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <h1 className="text-2xl font-bold font-heading text-[#171717]">Set up your profile</h1>
          <p className="text-sm text-[#6F6F6F]">Sign in first, then we'll help you set up your profile.</p>
          <Button onClick={() => openAuthModal('welcome')} variant="primary" size="lg" fullWidth>Sign in</Button>
        </div>
      </PageTransition>
    );
  }

  const toggleInterest = (tag) => {
    setSelectedInterests(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const handleFinish = async () => {
    setIsSaving(true);
    setError('');
    try {
      await updateProfile({
        location: location.trim().slice(0, 120),
        interests: selectedInterests,
        bio: bio.trim().slice(0, 500)
      });
      showToast(`Welcome to LEENKIT, ${(currentUser.name || '').split(' ')[0] || 'friend'}!`, 'success');
      navigate('/explore');
    } catch (err) {
      setError(err.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between text-xs font-semibold text-[#3D4948]">
          <span className="text-[#087F73] uppercase font-bold tracking-widest">Set up your profile</span>
          <span>Step {step} of 3</span>
        </div>

        <div className="w-full h-1.5 bg-[#DDE3E0] rounded-full overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
          <div className="h-full bg-[#18A999] transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        <div className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {error && (
            <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-700">{error}</p>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar src={currentUser.avatar} name={currentUser.name} size="xl" />
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold font-heading text-[#172121]">Welcome, {(currentUser.name || '').split(' ')[0]}!</h1>
                  <p className="text-xs text-[#3D4948]">You can add a real photo any time from Edit profile. It helps people recognise you when you meet.</p>
                </div>
              </div>

              <FormField label="Your area" helpText="Neighbourhood or city, e.g. Lekki, Lagos. Shown on your profile.">
                <input
                  type="text"
                  value={location}
                  maxLength={120}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Wuse 2, Abuja"
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                />
              </FormField>

              <Button onClick={() => setStep(2)} variant="primary" size="lg" fullWidth showArrow>Next: interests</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold font-heading text-[#172121]">What are you into?</h1>
                <p className="text-xs text-[#3D4948]">Pick a few. They appear on your profile so hosts and guests know what you enjoy.</p>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2" role="group" aria-label="Interests">
                {INTEREST_TAGS.map(tag => {
                  const isSelected = selectedInterests.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleInterest(tag)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isSelected ? 'bg-[#18A999] text-white shadow-xs' : 'bg-[#DDF4EF] text-[#3D4948] border border-[#DDE3E0] hover:text-[#172121]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => setStep(1)} variant="outline" size="lg" className="w-1/3">Back</Button>
                <Button onClick={() => setStep(3)} variant="primary" size="lg" className="w-2/3" showArrow>Next: short bio</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold font-heading text-[#172121]">Add a short bio</h1>
                <p className="text-xs text-[#3D4948]">Optional. A line or two about what you like doing.</p>
              </div>

              <FormField label="Bio" helpText={`${bio.length} / 500`}>
                <textarea
                  rows="4"
                  maxLength={500}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="e.g. Always up for a weekend photowalk, a coffee chat or five-a-side."
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                />
              </FormField>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => setStep(2)} variant="outline" size="lg" className="w-1/3" disabled={isSaving}>Back</Button>
                <Button onClick={handleFinish} variant="primary" size="lg" className="w-2/3" showArrow disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Finish'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="block mx-auto text-xs font-semibold text-[#3D4948] hover:text-[#172121] underline underline-offset-2 cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </PageTransition>
  );
}
