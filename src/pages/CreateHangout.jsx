import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, CheckCircle, ArrowRight, MessageSquare, Upload, Share2, Tag, AlertCircle } from 'lucide-react';
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
import { todayISO, formatEventDate, formatEventTime, formatMoney } from '../utils/format';
import { payoutService, estimateFee } from '../services/account/accountService';

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
  const { currentUser, acceptHostingGuidelines, isAuthenticated, isAuthLoading, openAuthModal } = useUser();

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
  
  const [payoutAccount, setPayoutAccount] = useState(undefined); // undefined = loading
  const [feeSettings, setFeeSettings] = useState({ percent: 10, minNgn: 200, minPaymentNgn: 1000 });

  useEffect(() => {
    payoutService.getFeeSettings().then(setFeeSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser?.id) { setPayoutAccount(null); return; }
    payoutService.getMyAccount(currentUser.id).then(setPayoutAccount).catch(() => setPayoutAccount(null));
  }, [currentUser?.id]);

  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isAcceptingGuidelines, setIsAcceptingGuidelines] = useState(false);

  const validate = () => {
    const errs = {};
    const title = formData.title.trim();
    if (!title) errs.title = 'Hangout title is required';
    else if (title.length < 5) errs.title = 'Title should be at least 5 characters';
    else if (title.length > 120) errs.title = 'Title can be up to 120 characters';
    
    const loc = formData.location;
    const mapsUrl = typeof loc === 'object' && loc ? (loc.googleMapsUrl || loc.rawGoogleMapsUrl || '') : (typeof loc === 'string' ? loc : '');

    if (!loc || !mapsUrl || !mapsUrl.trim()) {
      errs.location = 'Please enter a Google Maps link for your Hangout location';
    } else if (loc && typeof loc === 'object' && loc.hasUrlError) {
      errs.location = 'Please enter a valid Google Maps link (e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/...)';
    }

    if (!formData.date) errs.date = 'Date is required';
    else if (formData.date < todayISO()) errs.date = 'Pick today or a future date';
    if (!formData.time) errs.time = 'Start time is required';
    const description = formData.description.trim();
    if (!description) errs.description = 'Please add a brief description of what people will do';
    else if (description.length < 20) errs.description = 'Description should be at least 20 characters';
    else if (description.length > 5000) errs.description = 'Description can be up to 5,000 characters';
    const capacity = parseInt(formData.maxAttendees, 10);
    if (!Number.isFinite(capacity) || capacity < MIN_HANGOUT_CAPACITY) {
      errs.maxAttendees = `Minimum ${MIN_HANGOUT_CAPACITY} attendees required`;
    } else if (capacity > MAX_HANGOUT_CAPACITY) {
      errs.maxAttendees = `Maximum ${MAX_HANGOUT_CAPACITY.toLocaleString()} attendees allowed`;
    }

    if (formData.isPaid) {
      const parsedPrice = parseFloat(formData.price);
      if (!payoutAccount) {
        errs.price = 'Add your bank account in Payouts before selling tickets';
      } else if (isNaN(parsedPrice) || parsedPrice < feeSettings.minPaymentNgn) {
        errs.price = `Ticket price must be at least ${formatMoney(feeSettings.minPaymentNgn, 'NGN')}`;
      } else if (parsedPrice > 10000000) {
        errs.price = 'Ticket price is too high';
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
    if (!isAuthenticated) {
      openAuthModal('welcome');
      return;
    }
    if (!validate()) {
      setCreateError('Please fix the highlighted fields.');
      return;
    }
    setCreateError('');

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
            Pick a public venue, set a time and a guest limit. People can find your Hangout, join, and chat before meeting up.
          </p>
        </div>

        {!isAuthLoading && !isAuthenticated && (
          <div className="p-4 bg-[#DDF4EF] border border-[#18A999]/30 rounded-2xl text-sm text-[#087F73] flex flex-wrap items-center justify-between gap-3">
            <span>Sign in to publish a Hangout. You can fill in the details first.</span>
            <Button type="button" variant="primary" size="sm" onClick={() => openAuthModal('welcome')}>Sign in</Button>
          </div>
        )}

        {createError && (
          <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
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
                <span>{createdActivity.location?.placeName || 'Venue'} · {formatEventDate(createdActivity.date)}{createdActivity.time ? ` at ${formatEventTime(createdActivity.time)}` : ''}</span>
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
                  maxLength={120}
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
                    min={todayISO()}
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
                  />
                </FormField>

                <FormField label="Time" required error={errors.time}>
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
                    onClick={() => setFormData({ ...formData, isPaid: true, currency: 'NGN' })}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      formData.isPaid
                        ? 'bg-[#18A999] text-white border-[#18A999] shadow-xs'
                        : 'bg-white border-[#DDE3E0] text-[#3D4948] hover:border-[#18A999]'
                    }`}
                  >
                    Paid Hangout
                  </button>
                </div>

                {formData.isPaid && payoutAccount === null && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                    <span>To sell tickets, add the bank account your money should go to.</span>
                    <Link to="/payouts" className="font-bold underline">Set up payouts</Link>
                  </div>
                )}
                {formData.isPaid && payoutAccount && (
                  <p className="text-xs text-[#3D4948]">Payouts go to {payoutAccount.bankName} •••• {payoutAccount.accountLast4}.</p>
                )}

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
                          <span className="absolute left-3.5 text-xs font-bold text-[#3D4948]">₦</span>
                          <input
                            type="number"
                            min={feeSettings.minPaymentNgn}
                            step="50"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            placeholder="5000"
                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#DDE3E0] rounded-xl text-sm focus:outline-none focus:border-[#18A999]"
                          />
                        </div>
                      </FormField>

                      <FormField label="Currency">
                        <p className="px-4 py-2.5 bg-white border border-[#DDE3E0] rounded-xl text-sm font-semibold text-[#172121]">NGN (₦)</p>
                      </FormField>
                    </div>

                    <p className="text-[11px] text-[#3D4948] bg-white p-3 rounded-xl border border-[#DDE3E0]">
                      <strong>How tickets work:</strong> attendees pay online through Paystack. LEENKIT holds the money until after the Hangout and sends your share to your bank about 2 days after it starts, minus any refunds (people who leave at least 24 hours before the start get their money back minus LEENKIT's fee; if you cancel, everyone is refunded in full). LEENKIT keeps {feeSettings.percent}% (min {formatMoney(feeSettings.minNgn, 'NGN')}) and covers Paystack's card fees.
                      {Number(formData.price) >= feeSettings.minPaymentNgn && (
                        <> You receive <strong>{formatMoney(estimateFee(formData.price, feeSettings).hostAmount, 'NGN')}</strong> per ticket.</>
                      )}
                      {' '}The price can't change once a ticket is sold.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Description */}
              <FormField label="Description" required error={errors.description} helpText="Describe what attendees will do, what to bring, and exact meeting spot.">
                <textarea
                  rows="4"
                  maxLength={5000}
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
              <SafetyReminder mode="host" />
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
