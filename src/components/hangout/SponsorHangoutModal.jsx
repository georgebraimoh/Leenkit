import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import { hangoutService } from '../../services/hangout/hangoutService';
import { useUser } from '../../context/UserContext';

const CURRENCIES = [
  { code: 'NGN', symbol: '₦' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' }
];

export default function SponsorHangoutModal({ isOpen, onClose, hangout, onSponsorshipSuccess }) {
  const { currentUser } = useUser();

  const defaultCurrency = hangout?.currency || 'NGN';
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState('5000');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen || !hangout) return null;

  const currentSymbol = (CURRENCIES.find(c => c.code === currency) || CURRENCIES[0]).symbol;
  const numericAmount = parseFloat(amount) || 0;
  const formattedCTAAmount = numericAmount > 0
    ? `${currentSymbol}${numericAmount.toLocaleString()}`
    : `${currentSymbol}0`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!currentUser?.id) {
      setErrorMsg('You must be signed in to sponsor a Hangout.');
      return;
    }

    const validCurrencies = ['NGN', 'USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(currency)) {
      setErrorMsg('Please select a valid currency.');
      return;
    }

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid sponsorship amount greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await hangoutService.createHangoutSponsorship(currentUser.id, {
        hangoutId: hangout.id,
        amount: parsedAmount,
        currency,
        message
      });

      setIsSubmitted(true);
      if (onSponsorshipSuccess) {
        onSponsorshipSuccess(record);
      }
    } catch (err) {
      console.error('Sponsorship error:', err);
      setErrorMsg(err.message || 'Could not record sponsorship. Please verify you have joined this Hangout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative bg-white border border-[#DDE3E0] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6"
        >
          {/* Close Button */}
          <button
            onClick={handleResetAndClose}
            className="absolute top-5 right-5 p-2 text-[#6F6F6F] hover:text-[#171717] hover:bg-[#EEF1EF] rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {isSubmitted ? (
            /* Success State: Sponsorship Recorded */
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9 text-[#18A999]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold font-heading text-[#172121]">
                  Sponsorship recorded 🎉
                </h3>
                <p className="text-sm text-[#6F6F6F] leading-relaxed max-w-xs mx-auto">
                  Your sponsorship of <strong className="text-[#172121]">{currentSymbol}{numericAmount.toLocaleString()}</strong> has been recorded. No payment has been made. Payment will be available when sponsorship payments launch.
                </p>
              </div>

              <div className="pt-3">
                <Button onClick={handleResetAndClose} variant="primary" size="lg" fullWidth>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Form State: Enter Amount & Optional Message */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Header */}
              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#DDF4EF] text-[#18A999] rounded-full">
                    Community Sponsorship
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold font-heading text-[#172121] tracking-tight">
                  Sponsor this Hangout
                </h3>
                <p className="text-xs text-[#6F6F6F]">
                  Help make this Hangout better for everyone.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Currency & Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#171717] block">
                  Amount
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-3.5 py-3 bg-[#EEF1EF] border border-[#DDE3E0] focus:border-[#18A999] rounded-2xl text-sm font-bold text-[#171717] cursor-pointer outline-none"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="5000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-white border border-[#DDE3E0] focus:border-[#18A999] rounded-2xl text-base font-bold text-[#171717] outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Preset Amount Chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {['1000', '2000', '5000', '10000', '20000'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                        amount === preset
                          ? 'bg-[#172121] text-white border-[#172121]'
                          : 'bg-[#EEF1EF] text-[#3D4948] border-[#DDE3E0] hover:border-[#18A999]'
                      }`}
                    >
                      {currentSymbol}{Number(preset).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#171717] block">
                  Optional message
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. I'll cover the drinks."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#DDE3E0] focus:border-[#18A999] rounded-2xl text-xs text-[#171717] outline-none transition-colors"
                />
                <span className="text-[10px] text-[#6F6F6F] block text-right">
                  {message.length} / 200
                </span>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || numericAmount <= 0}
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="gap-2 shadow-sm"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>{isSubmitting ? 'Recording...' : `Sponsor ${formattedCTAAmount}`}</span>
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
