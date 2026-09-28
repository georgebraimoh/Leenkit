import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock, MapPin, Users, Image as ImageIcon, CheckCircle, ArrowRight, MessageSquare, Upload, X, Share2 } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import LocationPicker from '../components/common/LocationPicker';
import SafetyReminder from '../components/safety/SafetyReminder';
import ShareModal from '../components/common/ShareModal';
import { CATEGORIES } from '../data/categories';
import { useLeenkit } from '../context/LeenkitContext';
import { useUser } from '../context/UserContext';
import { hangoutService } from '../services/hangout/hangoutService';

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
  const { currentUser } = useUser();

  const [formData, setFormData] = useState({
    title: '',
    category: 'Food',
    location: null,
    date: '',
    time: '17:00',
    maxAttendees: 10,
    description: '',
    image: PRESET_IMAGES[0].url
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

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Hangout title is required';
    if (formData.title.trim().length < 5) errs.title = 'Title should be at least 5 characters';
    
    const loc = formData.location;
    const locText = typeof loc === 'string' ? loc : (loc?.placeName || loc?.address || '');

    if (!locText || !locText.trim()) {
      errs.location = 'Please enter the location of your Hangout';
    } else if (loc && typeof loc === 'object' && loc.hasUrlError) {
      errs.location = 'Please correct or remove the invalid Google Maps link before publishing';
    }

    if (!formData.date) errs.date = 'Date is required';
    if (!formData.description.trim()) errs.description = 'Please add a brief description of what people will do';
    if (formData.description.trim().length < 20) errs.description = 'Description should be at least 20 characters';
    if (!formData.maxAttendees || formData.maxAttendees < 2) errs.maxAttendees = 'Minimum 2 attendees required';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

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

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* SHARE MODAL FOR CREATED ACTIVITY */}
        {createdActivity && (
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            hangout={createdActivity}
          />
        )}

        {/* SUCCESS OVERLAY */}
        <AnimatePresence>
          {createdActivity ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-[#E8E6E1] rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl my-8"
            >
              <div className="w-20 h-20 bg-[#E8F0E8] text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10" />
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
                <p className="text-xs text-[#6F6F6F]">
                  📍 {createdActivity.location?.placeName || 'Venue'} · {createdActivity.date} at {createdActivity.time}
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
                    <MessageSquare className="w-5 h-5" />
                    <span>Go to space</span>
                  </Button>
                </Link>

                <Link to={`/hangout/${createdActivity.id}`}>
                  <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                    View Hangout details
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            /* FORM SECTION */
            <div className="space-y-8">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#18A999]">Host a Hangout</span>
                <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-[#172121]">
                  What Hangout are you planning?
                </h1>
                <p className="text-sm text-[#3D4948]">
                  Specify the location and details to host your Hangout.
                </p>
              </div>

              {/* Host Safety Reminder */}
              <SafetyReminder mode="host" />

              <form onSubmit={handleSubmit} className="bg-white border border-[#DDE3E0] rounded-3xl p-6 md:p-10 shadow-xs space-y-6">
                {/* Activity Name */}
                <FormField label="Hangout Title" required error={errors.title}>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Sunset Photowalk, Board Games & Suya, Rooftop Catan..."
                    className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                  />
                </FormField>

                {/* Where is it happening? (Manual Location Entry) */}
                <FormField label="Where is it happening?" required error={errors.location} helpText="Enter the location of your Hangout. You can optionally paste a Google Maps link.">
                  <LocationPicker
                    value={formData.location}
                    onSelectLocation={(loc) => setFormData({ ...formData, location: loc })}
                    error={errors.location}
                  />
                </FormField>

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
                      min="2"
                      max="50"
                      value={formData.maxAttendees}
                      onChange={e => setFormData({ ...formData, maxAttendees: e.target.value })}
                      className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                    />
                  </FormField>
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
                          className="text-xs font-semibold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove custom photo</span>
                        </button>
                      )}
                    </div>

                    {/* Image Validation Error Alert */}
                    {imageError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600">
                        {imageError}
                      </div>
                    )}

                    {/* Custom Image Preview */}
                    {customImagePreview ? (
                      <div className="relative h-40 rounded-2xl overflow-hidden border-2 border-[#18A999] max-w-md shadow-md">
                        <img src={customImagePreview} alt="Custom cover preview" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 bg-[#18A999] text-white p-1 rounded-full shadow-xs">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold p-2 text-center truncate">
                          Custom Cover: {customImageFile.name}
                        </span>
                      </div>
                    ) : (
                      /* Preset Images Grid */
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PRESET_IMAGES.map((img, idx) => {
                          const isSelected = formData.image === img.url;
                          return (
                            <motion.button
                              type="button"
                              key={idx}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => {
                                handleClearCustomImage();
                                setFormData({ ...formData, image: img.url });
                              }}
                              className={`relative h-20 rounded-xl overflow-hidden border-2 transition-colors cursor-pointer ${
                                isSelected ? 'border-[#18A999] shadow-md' : 'border-transparent opacity-75 hover:opacity-100'
                              }`}
                            >
                              <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-[#18A999] text-white p-0.5 rounded-full shadow-xs">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <span className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold p-1 truncate text-center">
                                {img.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </FormField>

                {/* Create Error Banner */}
                {createError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600">
                    {createError}
                  </div>
                )}

                {/* Submit Action */}
                <div className="pt-4 border-t border-[#E8E6E1]">
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>
                    <Button type="submit" variant="primary" size="lg" fullWidth showArrow disabled={isSubmitting}>
                      {isSubmitting ? (uploadingState || 'Publishing Hangout...') : 'Create Hangout'}
                    </Button>
                  </motion.div>
                </div>
              </form>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
