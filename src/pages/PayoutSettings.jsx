import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import FormField from '../components/common/FormField';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/common/Toast';
import { payoutService, estimateFee } from '../services/account/accountService';
import { formatMoney } from '../utils/format';

export default function PayoutSettings() {
  const { currentUser, isAuthenticated, isAuthLoading, openAuthModal } = useUser();
  const { showToast } = useToast();

  const [account, setAccount] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [fees, setFees] = useState({ percent: 10, minNgn: 200, minPaymentNgn: 1000 });
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      payoutService.getMyAccount(currentUser.id).catch(() => null),
      payoutService.getEarnings().catch(() => []),
      payoutService.getFeeSettings()
    ]).then(([acc, earn, fee]) => {
      if (!active) return;
      setAccount(acc);
      setEarnings(earn);
      setFees(fee);
      setIsEditing(!acc);
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isEditing || banks.length > 0 || !currentUser?.id) return;
    payoutService.listBanks()
      .then(setBanks)
      .catch(err => setError(err.message || 'Could not load the list of banks.'));
  }, [isEditing, banks.length, currentUser?.id]);

  // Verify the account name as soon as 10 digits and a bank are entered.
  useEffect(() => {
    setResolvedName('');
    if (!bankCode || accountNumber.length !== 10) return;
    let active = true;
    setIsResolving(true);
    setError('');
    payoutService.resolveAccount(bankCode, accountNumber)
      .then(name => { if (active) setResolvedName(name); })
      .catch(err => { if (active) setError(err.message || 'We could not verify that account.'); })
      .finally(() => { if (active) setIsResolving(false); });
    return () => { active = false; };
  }, [bankCode, accountNumber]);

  const example = useMemo(() => estimateFee(5000, fees), [fees]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!resolvedName) return;
    setIsSaving(true);
    setError('');
    try {
      const saved = await payoutService.saveAccount(bankCode, accountNumber);
      setAccount(saved);
      setIsEditing(false);
      setAccountNumber('');
      showToast('Payout account saved.', 'success');
    } catch (err) {
      setError(err.message || 'Could not save your payout account.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center" aria-busy="true"><div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <h1 className="text-2xl font-bold font-heading text-[#171717]">Payouts</h1>
          <p className="text-sm text-[#6F6F6F]">Sign in to set up where your ticket and sponsorship money is paid.</p>
          <Button onClick={() => openAuthModal('login')} variant="primary" size="lg" fullWidth>Sign in</Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8 pb-24">
        <Link to="/my-hangouts" className="inline-flex items-center gap-2 text-xs font-semibold text-[#6F6F6F] hover:text-[#171717]">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Your Hangouts
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold font-heading text-[#172121]">Payouts</h1>
          <p className="text-sm text-[#3D4948]">
            LEENKIT collects ticket and sponsorship payments and holds your share until after the Hangout, so buyers can be
            refunded if plans change. About 2 days after each Hangout starts, your share is sent to your bank account by
            Paystack transfer, minus any refunds. LEENKIT keeps {fees.percent}% (minimum {formatMoney(fees.minNgn, 'NGN')}) and
            pays the Paystack card fees.
          </p>
        </div>

        <div className="p-5 bg-[#DDF4EF]/60 border border-[#18A999]/30 rounded-2xl text-sm text-[#172121] space-y-1">
          <p className="font-bold">Example: a {formatMoney(5000, 'NGN')} ticket</p>
          <p>You receive <strong>{formatMoney(example.hostAmount, 'NGN')}</strong>. LEENKIT keeps {formatMoney(example.fee, 'NGN')}. The buyer pays {formatMoney(5000, 'NGN')}, nothing extra.</p>
        </div>

        {earnings.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {earnings.map(e => (
              <React.Fragment key={e.currency}>
                <div className="p-5 bg-white border border-[#DDE3E0] rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">To be paid</p>
                  <p className="text-2xl font-extrabold font-heading text-[#172121]">{formatMoney(e.toBePaid, e.currency)}</p>
                  <p className="text-xs text-[#6F6F6F]">
                    {formatMoney(e.paidOut, e.currency)} already paid to your bank · {formatMoney(e.gross, e.currency)} in sales
                  </p>
                </div>
                <div className="p-5 bg-white border border-[#DDE3E0] rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">Sold</p>
                  <p className="text-2xl font-extrabold font-heading text-[#172121]">{e.ticketsSold} tickets</p>
                  <p className="text-xs text-[#6F6F6F]">{e.sponsorships} sponsorships{e.pendingRefunds ? ` · ${e.pendingRefunds} refunds pending` : ''}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </p>
        )}

        {isLoading ? (
          <div className="h-40 bg-white border border-[#E8E6E1] rounded-3xl animate-pulse" aria-busy="true" />
        ) : account && !isEditing ? (
          <div className="p-6 bg-white border border-[#DDE3E0] rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#DDF4EF] text-[#087F73] flex items-center justify-center">
                <Banknote className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#172121]">{account.accountName}</p>
                <p className="text-xs text-[#6F6F6F]">{account.bankName} · •••• {account.accountLast4}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 ml-auto" aria-label="Verified" />
            </div>
            <p className="text-xs text-[#6F6F6F]">You can now sell tickets and receive sponsorships.</p>
            <div className="flex gap-3">
              <Link to="/create"><Button variant="primary" size="md">Host a paid Hangout</Button></Link>
              <Button variant="outline" size="md" onClick={() => setIsEditing(true)}>Change account</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 bg-white border border-[#DDE3E0] rounded-3xl space-y-5">
            <h2 className="text-lg font-bold font-heading text-[#172121]">{account ? 'Change payout account' : 'Add your bank account'}</h2>

            <FormField label="Bank" required>
              <select
                value={bankCode}
                onChange={e => setBankCode(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
              >
                <option value="">{banks.length ? 'Choose your bank' : 'Loading banks...'}</option>
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </FormField>

            <FormField label="Account number" required helpText="10-digit NUBAN. The account name must match yours.">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0123456789"
                className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm tracking-widest focus:outline-none focus:bg-white focus:border-[#18A999]"
              />
            </FormField>

            <div aria-live="polite" className="min-h-[1.5rem] text-sm">
              {isResolving && <span className="text-[#6F6F6F]">Checking account...</span>}
              {resolvedName && !isResolving && (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" /> {resolvedName}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {account && (
                <Button type="button" variant="outline" size="md" onClick={() => { setIsEditing(false); setError(''); }}>Cancel</Button>
              )}
              <Button type="submit" variant="primary" size="md" disabled={!resolvedName || isSaving}>
                {isSaving ? 'Saving...' : 'Confirm and save'}
              </Button>
            </div>

            <p className="text-xs text-[#6F6F6F]">
              We check the account number with Paystack and show the account name your bank returns. LEENKIT stores only the bank, account name and last 4 digits; Paystack holds the full details.
            </p>
          </form>
        )}
      </div>
    </PageTransition>
  );
}
