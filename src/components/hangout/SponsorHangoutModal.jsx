import React, { useState } from 'react';
import { Heart, CheckCircle2, AlertCircle, CreditCard, Bookmark } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { hangoutService } from '../../services/hangout/hangoutService';
import { paymentService } from '../../services/payment/paymentService';
import { useUser } from '../../context/UserContext';
import { usePaidFeatures } from '../../hooks/usePaidFeatures';

// Sponsorships are paid out to Nigerian bank accounts, so NGN only.
const CURRENCIES = [
  { code: 'NGN', symbol: '₦' }
];
const MIN_SPONSORSHIP_NGN = 1000;

export default function SponsorHangoutModal({ isOpen, onClose, hangout, onSponsorshipSuccess }) {
  const { currentUser } = useUser();

  const [currency, setCurrency] = useState('NGN');
  const [amount, setAmount] = useState('5000');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('paystack'); // 'paystack' | 'pledge'
  const { paidEnabled } = usePaidFeatures();
  // Online sponsorship is only offered while paid features are switched on.
  const effectiveMode = paidEnabled ? mode : 'pledge';

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
    if (effectiveMode === 'paystack' && parsedAmount < MIN_SPONSORSHIP_NGN) {
      setErrorMsg(`The minimum sponsorship is ₦${MIN_SPONSORSHIP_NGN.toLocaleString()}.`);
      return;
    }
    if (parsedAmount > 10000000) {
      setErrorMsg('That amount is too large.');
      return;
    }

    setIsSubmitting(true);

    if (effectiveMode === 'pledge') {
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
        setErrorMsg(err.message || 'Could not record pledge. Please verify you have joined this Hangout.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Paystack Payment Mode: Server Authorization Redirect
      try {
        const { authorization_url } = await paymentService.initializeTransaction({
          hangoutId: hangout.id,
          paymentType: 'sponsorship',
          amount: parsedAmount,
          currency,
          message,
          callbackUrl: `${window.location.origin}/hangout/${hangout.id}`,
        });

        if (authorization_url) {
          window.location.href = authorization_url;
        } else {
          throw new Error('Paystack authorization URL missing.');
        }
      } catch (err) {
        console.error('Paystack sponsorship initialization error:', err);
        setErrorMsg(err.message || 'Could not initialize Paystack payment.');
        setIsSubmitting(false);
      }
    }
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleResetAndClose} title={isSubmitted ? undefined : 'Sponsor this Hangout'} maxWidth="max-w-md">
          {isSubmitted ? (
            /* Success State: Sponsorship Recorded */
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9 text-[#18A999]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold font-heading text-[#172121]">
                  Pledge recorded
                </h3>
                <p className="text-sm text-[#6F6F6F] leading-relaxed max-w-xs mx-auto">
                  You pledged <strong className="text-[#172121]">{currentSymbol}{numericAmount.toLocaleString()}</strong>. No money has moved: a pledge is a promise you settle with the host yourself. It shows as "pledged (unpaid)" to people going. To pay now, choose Paystack instead.
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
              <p className="text-xs text-[#6F6F6F] -mt-2">
                Help cover snacks, gear or the venue. {paidEnabled ? "Paystack payments go to the host after the Hangout (LEENKIT keeps a platform fee of 10%, minimum ₦200, and covers card fees). Pledges are promises with no payment." : "A pledge is a promise to the host with no payment through LEENKIT. Online sponsorships are coming soon."}
              </p>

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

              {/* Sponsorship Mode Selector */}
              {paidEnabled && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#EEF1EF] rounded-2xl border border-[#DDE3E0]">
                <button
                  type="button"
                  onClick={() => setMode('paystack')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    effectiveMode === 'paystack'
                      ? 'bg-[#18A999] text-white shadow-xs'
                      : 'text-[#6F6F6F] hover:text-[#171717]'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Paystack Online</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('pledge')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    effectiveMode === 'pledge'
                      ? 'bg-[#172121] text-white shadow-xs'
                      : 'text-[#6F6F6F] hover:text-[#172121]'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Pledge Only</span>
                </button>
              </div>
              )}

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
                  <span>
                    {isSubmitting
                      ? 'Initializing...'
                      : effectiveMode === 'paystack'
                      ? `Pay ${formattedCTAAmount} via Paystack`
                      : `Pledge ${formattedCTAAmount}`}
                  </span>
                </Button>
              </div>
            </form>
          )}
    </Modal>
  );
}
