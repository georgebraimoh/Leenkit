import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import LocationAutocomplete from '../components/common/LocationAutocomplete';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/common/Toast';
import { Sparkles, MapPin, CheckCircle, ArrowRight } from 'lucide-react';

const INTEREST_TAGS = [
  "Food & Suya", "Music & Vibes", "Sports & Football", "Board Games",
  "Photography", "Movies", "Art & Design", "Tech & Coffee", "Fitness & Running",
  "Outdoors & Kayaking"
];

const AVATAR_OPTIONS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { currentUser, updateProfile } = useUser();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [avatar, setAvatar] = useState(currentUser.avatar || AVATAR_OPTIONS[0]);
  const [location, setLocation] = useState(currentUser.location || null);
  const [selectedInterests, setSelectedInterests] = useState(currentUser.interests || ["Food & Suya", "Tech & Coffee"]);
  const [bio, setBio] = useState(currentUser.bio || "Excited to meet new people and join activities around my area!");

  const toggleInterest = (tag) => {
    setSelectedInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFinish = () => {
    updateProfile({
      avatar,
      location: location?.placeName ? `${location.placeName}, ${location.city}` : (currentUser.location || "Local Member"),
      interests: selectedInterests,
      bio,
      isOnboarded: true
    });

    showToast(`Welcome to LEENKIT, ${currentUser.name.split(' ')[0]}!`, 'success');
    navigate('/explore');
  };

  return (
    <PageTransition>
      <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between text-xs font-semibold text-[#3D4948]">
          <span className="text-[#18A999] uppercase font-bold tracking-widest">Setup your profile</span>
          <span>Step {step} of 3</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[#DDE3E0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#18A999] transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {/* STEP 1: Avatar & Location */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold font-heading text-[#172121]">
                  Welcome! Choose your picture & location
                </h2>
                <p className="text-xs text-[#3D4948]">
                  This helps fellow attendees know who is showing up.
                </p>
              </div>

              {/* Avatar Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#172121]">
                  Profile Picture
                </label>
                <div className="flex items-center gap-3 pt-1">
                  {AVATAR_OPTIONS.map((url, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setAvatar(url)}
                      className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                        avatar === url ? 'border-[#18A999] ring-2 ring-[#18A999]/30 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="Avatar option" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Autocomplete */}
              <FormField label="Your Home Location / Area">
                <LocationAutocomplete
                  value={location}
                  onSelectLocation={(loc) => setLocation(loc)}
                  placeholder="Search a place, landmark, or venue near you..."
                />
              </FormField>

              <Button onClick={() => setStep(2)} variant="primary" size="lg" fullWidth showArrow>
                Next: Select interests
              </Button>
            </div>
          )}

          {/* STEP 2: Interests */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold font-heading text-[#172121]">
                  What are you into?
                </h2>
                <p className="text-xs text-[#3D4948]">
                  Select activities you enjoy. We'll highlight them on your explore feed.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                {INTEREST_TAGS.map(tag => {
                  const isSelected = selectedInterests.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#18A999] text-white shadow-xs scale-105'
                          : 'bg-[#DDF4EF] text-[#3D4948] border border-[#DDE3E0] hover:text-[#172121]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => setStep(1)} variant="outline" size="lg" className="w-1/3">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} variant="primary" size="lg" className="w-2/3" showArrow>
                  Next: Short bio
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Bio & Finish */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold font-heading text-[#172121]">
                  Add a short bio
                </h2>
                <p className="text-xs text-[#3D4948]">
                  Tell the community what you're excited about.
                </p>
              </div>

              <FormField label="Bio">
                <textarea
                  rows="4"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="e.g. Always up for a weekend photowalk, coffee chat, or sunset kayaking..."
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                />
              </FormField>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => setStep(2)} variant="outline" size="lg" className="w-1/3">
                  Back
                </Button>
                <Button onClick={handleFinish} variant="primary" size="lg" className="w-2/3" showArrow>
                  Complete & Explore
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
