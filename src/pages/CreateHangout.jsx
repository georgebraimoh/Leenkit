import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock, MapPin, Users, Image as ImageIcon, CheckCircle, ArrowRight, MessageSquare, Upload, X, Share2, Tag, DollarSign, AlertCircle } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import LocationPicker from '../components/common/LocationPicker';
import SafetyReminder from '../components/safety/SafetyReminder';
import ShareModal from '../components/common/ShareModal';
import HostingGuidelinesModal from '../components/common/HostingGuidelinesModal';
import { CATEGORIES } from '../data/categories';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';
import { hangoutService, MIN_HANGOUT_CAPACITY, MAX_HANGOUT_CAPACITY } from '../services/hangout/hangoutService';
import { CURRENT_GUIDELINES_VERSION } from '../services/auth/authService';

const PRESET_IMAGES = [
  { label: "Photowalk / Outdoor", url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80" },
  { label: "Food & Suya Grill", url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80" },
  { label: "Board Games / Indoors", url: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=80" },
  { label: "Tech & Coffee House", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80" },
  { label: "Acoustic & Music", url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80" },
  { label: "Fitness & Morning Run", url: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80" },
  { label: "Kayaking & Water", url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80" }
];

export default function CreateHangout() {
  const navigate = useNavigate();
  const { createHangout } = useLeenkit();
  const { currentUser, acceptHostingGuidelines } = useUser();

  const [formData, setFormData] = useState({
    title: '',
    category: 'Food',
    location: null,
    date: '',
    time: '17:00',
    maxAttendees: 10,
    description: '',
    image: PRESET_IMAGES[0].url,
    isPaid: false,
    price: '',
    currency: 'NGN'
  });

  const [customImageFile, setCustomImageFile] = useState(null);
  const [customImagePreview, setCustomImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [uploadingState, setUploadingState] = useState('');

  const [errors, setErrors] = useState({});
  const [createdActivity, setCreatedActivity] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isAcceptingGuidelines, setIsAcceptingGuidelines] = useState(false);

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Hangout title is required';
    if (formData.title.trim().length < 5) errs.title = 'Title should be at least 5 characters';
    
    const loc = formData.location;
    const mapsUrl = typeof loc === 'object' && loc ? (loc.googleMapsUrl || loc.rawGoogleMapsUrl || '') : (typeof loc === 'string' ? loc : '');

    if (!loc || !mapsUrl || !mapsUrl.trim()) {
      errs.location = 'Please enter a Google Maps link for your Hangout location';
    } else if (loc && typeof loc === 'object' && loc.hasUrlError) {
      errs.location = 'Please enter a valid Google Maps link (e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/...)';
    }

    if (!formData.date) errs.date = 'Date is required';
    if (!formData.description.trim()) errs.description = 'Please add a brief description of what people will do';
    if (formData.description.trim().length < 20) errs.description = 'Description should be at least 20 characters';
    const capacity = parseInt(formData.maxAttendees, 10);
    if (!Number.isFinite(capacity) || capacity < MIN_HANGOUT_CAPACITY) {
      errs.maxAttendees = `Minimum ${MIN_HANGOUT_CAPACITY} attendees required`;
    } else if (capacity > MAX_HANGOUT_CAPACITY) {
      errs.maxAttendees = `Maximum ${MAX_HANGOUT_CAPACITY.toLocaleString()} attendees allowed`;
    }

    if (formData.isPaid) {
      const parsedPrice = parseFloat(formData.price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        errs.price = 'Paid Hangouts require a valid ticket price greater than 0';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError('');

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB limit
    if (file.size > MAX_SIZE) {
      setImageError('Selected image exceeds the 5 MB size limit.');
      e.target.value = '';
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setImageError('Unsupported image format. Please select a JPG, PNG, or WEBP image.');
      e.target.value = '';
      return;
    }

    setCustomImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setCustomImagePreview(previewUrl);
    e.target.value = '';
  };

  const handleClearCustomImage = () => {
    setCustomImageFile(null);
    if (customImagePreview) {
      URL.revokeObjectURL(customImagePreview);
    }
    setCustomImagePreview(null);
    setImageError('');
  };

  const doSubmit = async () => {
    setIsSubmitting(true);
    setCreateError('');
    setUploadingState('');

    let finalImageUrl = formData.image;

    try {
      if (customImageFile) {
        setUploadingState('Uploading image...');
        const publicUrl = await hangoutService.uploadHangoutImage(currentUser?.id, customImageFile);
        if (publicUrl) {
          finalImageUrl = publicUrl;
        }
      }

      setUploadingState('Publishing Hangout...');
      const newActivity = await createHangout({
        ...formData,
        image: finalImageUrl
      });
      setCreatedActivity(newActivity);
    } catch (err) {
      setCreateError(err.message || 'Failed to create Hangout.');
    } finally {
      setIsSubmitting(false);
      setUploadingState('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Check if user has accepted current Hosting Guidelines version
    const hasAcceptedGuidelines =
      currentUser?.hostingGuidelinesAcceptedAt &&
      currentUser?.hostingGuidelinesVersion === CURRENT_GUIDELINES_VERSION;

    if (!hasAcceptedGuidelines) {
      setIsGuidelinesModalOpen(true);
      return;
    }

    await doSubmit();
  };

  const handleAcceptGuidelines = async (version) => {
    setIsAcceptingGuidelines(true);
    setCreateError('');
    try {
      await acceptHostingGuidelines(version);
      setIsGuidelinesModalOpen(false);
      await doSubmit();
    } catch (err) {
      setCreateError(err.message || 'Could not accept guidelines. Please try again.');
      throw err;
    } finally {
      setIsAcceptingGuidelines(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Hosting Guidelines Modal */}
        <HostingGuidelinesModal
          isOpen={isGuidelinesModalOpen}
          onClose={() => setIsGuidelinesModalOpen(false)}
          onAccept={handleAcceptGuidelines}
          isLoading={isAcceptingGuidelines}
        />

        {/* Share Modal on Success */}
        {createdActivity && (
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            hangout={createdActivity}
          />
        )}

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Bring People Together</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[#172121]">
            Host a Hangout
          </h1>
          <p className="text-sm text-[#3D4948] max-w-xl">
            Create a real-life Hangout at a public coordinate. Anyone can join, discover your event, and connect in person.
          </p>
        </div>

        {createError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{createError}</span>
          </div>
        )}

        {createdActivity ? (
          /* Success Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-[#DDE3E0] rounded-3xl p-8 text-center space-y-6 shadow-sm"
          >
            <div className="w-16 h-16 bg-[#DDF4EF] text-[#18A999] rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Success</span>
              <h2 className="text-3xl font-bold font-heading text-[#172121]">
                Your Hangout is live.
              </h2>
              <p className="text-sm text-[#3D4948] max-w-md mx-auto leading-relaxed">
                Your LEENKIT Space is ready. People can now discover and join you at {createdActivity.location?.placeName || 'your venue'}.
              </p>
            </div>

            <div className="p-4 bg-[#EEF1EF] rounded-2xl max-w-sm mx-auto text-left space-y-1 border border-[#DDE3E0]">
              <p className="text-xs font-bold uppercase text-[#18A999]">{createdActivity.category}</p>
              <h4 className="font-bold text-[#171717] font-heading">{createdActivity.title}</h4>
              <p className="text-xs text-[#6F6F6F] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#18A999] shrink-0" />
                <span>{createdActivity.location?.placeName || 'Venue'} · {createdActivity.date} at {createdActivity.time}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => setIsShareModalOpen(true)}
                className="w-full sm:w-auto gap-2"
              >
                <Share2 className="w-5 h-5" />
                <span>Share Hangout</span>
              </Button>

              <Link to={`/hangout/${createdActivity.id}/space`}>
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                  <MessageSquare className="w-5 h-5 text-[#18A999]" />
                  <span>Open Space Chat</span>
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          /* Hangout Creation Form */
          <form onSubmit={handleSubmit} className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
            <div className="space-y-6">
              {/* Title */}
              <FormField label="Hangout Title" required error={errors.title}>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Saturday Morning Coffee & Photowalk"
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                />
              </FormField>

              {/* Location Picker */}
              <LocationPicker
                value={formData.location}
                onSelectLocation={loc => setFormData({ ...formData, location: loc })}
                onChange={loc => setFormData({ ...formData, location: loc })}
                error={errors.location}
              />

              {/* Category */}
              <FormField label="Category" required>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </FormField>

              {/* Date, Time & Max Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <FormField label="Date" required error={errors.date}>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                  />
                </FormField>

                <FormField label="Time" required>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                  />
                </FormField>

                <FormField label="Max Capacity" required error={errors.maxAttendees}>
                  <input
                    type="number"
                    min={MIN_HANGOUT_CAPACITY}
                    max={MAX_HANGOUT_CAPACITY}
                    value={formData.maxAttendees}
                    onChange={e => setFormData({ ...formData, maxAttendees: e.target.value })}
                    className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                  />
                </FormField>
              </div>

              {/* Paid vs Free Hangout Readiness Section */}
              <div className="pt-2 p-5 bg-[#EEF1EF]/70 border border-[#DDE3E0] rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#172121] uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#18A999]" />
                      <span>Event Admission & Price</span>
                    </span>
                    <p className="text-xs text-[#3D4948]">
                      Choose whether your Hangout is Free or requires an intended ticket/entry price.
                    </p>
                  </div>
                </div>

                {/* Free vs Paid Radio Pill Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isPaid: false, price: '' })}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      !formData.isPaid
                        ? 'bg-[#172121] text-white border-[#172121] shadow-xs'
                        : 'bg-white border-[#DDE3E0] text-[#3D4948] hover:border-[#18A999]'
                    }`}
                  >
                    Free Hangout
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isPaid: true })}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      formData.isPaid
                        ? 'bg-[#18A999] text-white border-[#18A999] shadow-xs'
                        : 'bg-white border-[#DDE3E0] text-[#3D4948] hover:border-[#18A999]'
                    }`}
                  >
                    Paid Hangout
                  </button>
                </div>

                {/* Paid Input Fields */}
                {formData.isPaid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-2 border-t border-[#DDE3E0]"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Ticket Price" required error={errors.price}>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 text-xs font-bold text-[#3D4948]">
                            {formData.currency === 'NGN' ? '₦' : formData.currency === 'USD' ? '$' : formData.currency === 'EUR' ? '€' : '£'}
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            placeholder="5000"
                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#DDE3E0] rounded-xl text-sm focus:outline-none focus:border-[#18A999]"
                          />
                        </div>
                      </FormField>

                      <FormField label="Currency" required>
                        <select
                          value={formData.currency}
                          onChange={e => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white border border-[#DDE3E0] rounded-xl text-sm focus:outline-none focus:border-[#18A999]"
                        >
                          <option value="NGN">NGN (₦)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </FormField>
                    </div>

                    <p className="text-[11px] text-[#3D4948] bg-white p-3 rounded-xl border border-[#DDE3E0]">
                      ℹ️ <strong>Note:</strong> LEENKIT displays ticket prices for attendee expectations. Online payment processing is not enabled yet; entry fees are settled directly at the venue.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Description */}
              <FormField label="Description" required error={errors.description} helpText="Describe what attendees will do, what to bring, and exact meeting spot.">
                <textarea
                  rows="4"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide details about the meeting point, activities, vibes..."
                  className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                />
              </FormField>

              {/* Cover Image Picker & File Upload */}
              <FormField label="Cover Image" helpText="Upload a photo from your device or select a preset cover for your Hangout.">
                <div className="space-y-4 pt-1">
                  {/* Device Upload Control */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-2.5 bg-white border border-[#DDE3E0] hover:border-[#18A999] hover:text-[#18A999] rounded-2xl text-xs font-semibold text-[#172121] flex items-center gap-2 transition-all shadow-xs cursor-pointer">
                      <Upload className="w-4 h-4 text-[#18A999]" />
                      <span>Upload photo from device</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {customImageFile && (
                      <button
                        type="button"
                        onClick={handleClearCustomImage}
                        className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        Remove custom photo
                      </button>
                    )}
                  </div>

                  {/* Image Upload Error Alert */}
                  {imageError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600">
                      {imageError}
                    </div>
                  )}

                  {/* Custom Upload Preview */}
                  {customImagePreview && (
                    <div className="relative h-44 rounded-2xl overflow-hidden border-2 border-[#18A999] shadow-sm">
                      <img src={customImagePreview} alt="Custom cover preview" className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/60 text-white text-[10px] font-bold rounded-lg backdrop-blur-xs">
                        Custom photo preview
                      </span>
                    </div>
                  )}

                  {/* Preset Options Grid */}
                  {!customImagePreview && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-[#6F6F6F]">Or choose a preset cover image:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PRESET_IMAGES.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              handleClearCustomImage();
                              setFormData({ ...formData, image: img.url });
                            }}
                            className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                              formData.image === img.url ? 'border-[#18A999] ring-2 ring-[#18A999]/30 scale-102' : 'border-transparent opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white bg-black/50 px-1 py-0.5 rounded truncate">
                              {img.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </FormField>

              {/* Safety Reminder Card */}
              <SafetyReminder />
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-[#DDE3E0] flex items-center justify-between">
              <Button type="button" variant="outline" size="md" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="gap-2">
                <span>{isSubmitting ? (uploadingState || 'Publishing...') : 'Publish Hangout'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageTransition>
  );
}
