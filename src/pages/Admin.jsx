import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, RotateCcw, Ban, XCircle, ExternalLink, CheckCircle2, Clock, Wallet, Users } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/common/Toast';
import { adminService } from '../services/admin/adminService';
import { formatMoney } from '../utils/format';

const REPORT_FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' }
];

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  reviewing: 'bg-sky-50 text-sky-800 border-sky-200',
  resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  dismissed: 'bg-stone-100 text-stone-700 border-stone-200'
};

function when(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function targetLink(r) {
  if (r.target_type === 'user') return r.target_username ? `/profile/${r.target_username}` : null;
  if (r.target_type === 'space') return `/hangout/${r.target_id}/space`;
  return `/hangout/${r.target_id}`;
}

export default function Admin() {
  const { currentUser, isAuthLoading } = useUser();
  const { showToast } = useToast();

  const [tab, setTab] = useState('reports');
  const [overview, setOverview] = useState(null);
  const [reportFilter, setReportFilter] = useState('open');
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // { kind: 'report'|'suspend'|'cancel'|'refund', item, status? }
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState('');

  const isAdmin = Boolean(currentUser?.isAdmin);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError('');
    try {
      const [ov, reps, pays] = await Promise.all([
        adminService.overview(),
        adminService.listReports(reportFilter === 'all' || reportFilter === 'open' ? null : reportFilter),
        adminService.listPayments('requires_refund')
      ]);
      setOverview(ov);
      setReports(reportFilter === 'open' ? reps.filter(r => r.status === 'pending' || r.status === 'reviewing') : reps);
      setPayments(pays);
    } catch (err) {
      setError(err.message || 'Could not load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, reportFilter]);

  useEffect(() => { load(); }, [load]);

  const openAction = (kind, item, status) => {
    setAction({ kind, item, status });
    setNote('');
    setActionError('');
  };

  const runAction = async () => {
    if (!action) return;
    setActionError('');
    // A payment is only marked refunded with evidence of a real Paystack
    // refund (the database enforces this too).
    if (action.kind === 'refund' && !note.trim()) {
      setActionError('Enter the Paystack refund reference. Issue the refund in Paystack first.');
      return;
    }
    setIsWorking(true);
    try {
      const { kind, item, status } = action;
      if (kind === 'report') await adminService.updateReport(item.id, status, note);
      if (kind === 'suspend') {
        await adminService.setSuspension(item.target_id, true, note || item.reason);
        await adminService.updateReport(item.id, 'resolved', note || 'Account suspended');
      }
      if (kind === 'cancel') {
        await adminService.cancelHangout(item.target_id);
        await adminService.updateReport(item.id, 'resolved', note || 'Hangout cancelled by LEENKIT');
      }
      if (kind === 'refund') await adminService.markRefunded(item.id, note);
      setAction(null);
      showToast('Done.', 'success');
      load();
    } catch (err) {
      setActionError(err.message || 'That did not work.');
    } finally {
      setIsWorking(false);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center" aria-busy="true"><div className="w-8 h-8 border-4 border-[#18A999] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-[#6F6F6F] mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold font-heading text-[#172121]">Admins only</h1>
          <p className="text-sm text-[#6F6F6F]">This page is for the LEENKIT team.</p>
        </div>
      </PageTransition>
    );
  }

  const actionCopy = action && {
    report: { title: action.status === 'dismissed' ? 'Dismiss report' : action.status === 'reviewing' ? 'Mark as reviewing' : 'Resolve report', confirm: 'Save', variant: 'primary' },
    suspend: { title: `Suspend ${action.item.target_label}?`, confirm: 'Suspend account', variant: 'danger', body: 'They will not be able to host, join or post. Their upcoming Hangouts are cancelled and attendees notified.' },
    cancel: { title: `Cancel "${action.item.target_label}"?`, confirm: 'Cancel Hangout', variant: 'danger', body: 'Attendees are notified. Paid tickets are added to Refunds.' },
    refund: { title: 'Mark as refunded', confirm: 'Mark refunded', variant: 'primary', body: `Refund ${formatMoney(action.item.amount, action.item.currency)} to ${action.item.payer_name || 'the buyer'} in your Paystack dashboard first (Transactions → search the reference → Refund). Then record it here.` }
  }[action.kind];

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold font-heading text-[#172121]">Admin</h1>
            <p className="text-sm text-[#6F6F6F]">Safety reports, suspensions and refunds.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> Refresh
          </Button>
        </div>

        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Open reports', value: overview.pendingReports, icon: ShieldAlert },
              { label: 'Refunds due', value: overview.refundsDue, icon: Wallet },
              { label: 'Suspended', value: overview.suspendedUsers, icon: Ban },
              { label: 'Fees collected', value: formatMoney(overview.feesCollectedNgn, 'NGN'), icon: Users }
            ].map(s => (
              <div key={s.label} className="p-5 bg-white border border-[#DDE3E0] rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">{s.label}</span>
                  <s.icon className="w-4 h-4 text-[#18A999]" aria-hidden="true" />
                </div>
                <p className="text-2xl font-extrabold font-heading text-[#172121] mt-2">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 border-b border-[#DDE3E0] pb-2" role="tablist">
          {[{ id: 'reports', label: 'Reports' }, { id: 'refunds', label: `Refunds (${payments.length})` }].map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer ${tab === t.id ? 'bg-[#171717] text-white' : 'text-[#3D4948] hover:bg-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700">{error}</p>}

        {tab === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reports">
              {REPORT_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={reportFilter === f.id}
                  onClick={() => setReportFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${reportFilter === f.id ? 'bg-[#18A999] text-white' : 'bg-white border border-[#E8E6E1] text-[#3D4948]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="h-32 bg-white border border-[#E8E6E1] rounded-2xl animate-pulse" aria-busy="true" />
            ) : reports.length === 0 ? (
              <p className="p-8 bg-white border border-[#E8E6E1] rounded-2xl text-center text-sm text-[#6F6F6F]">No reports here.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map(r => {
                  const link = targetLink(r);
                  const isOpen = r.status === 'pending' || r.status === 'reviewing';
                  return (
                    <li key={r.id} className="p-5 bg-white border border-[#DDE3E0] rounded-2xl space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#6F6F6F]">
                              {r.target_type === 'user' ? 'Member' : r.target_type === 'space' ? 'Hangout Space' : 'Hangout'}
                            </span>
                            {Number(r.reports_on_target) > 1 && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                {r.reports_on_target} reports on this
                              </span>
                            )}
                          </div>
                          <p className="text-base font-bold text-[#172121] break-words">
                            {link ? <Link to={link} className="hover:underline inline-flex items-center gap-1">{r.target_label} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></Link> : r.target_label}
                          </p>
                          <p className="text-sm font-semibold text-rose-700">{r.reason}</p>
                          {r.description && <p className="text-sm text-[#3D4948] whitespace-pre-line break-words">{r.description}</p>}
                          <p className="text-xs text-[#6F6F6F]">
                            Reported by {r.reporter_username ? <Link to={`/profile/${r.reporter_username}`} className="underline">{r.reporter_name}</Link> : (r.reporter_name || 'a member')} · {when(r.created_at)}
                          </p>
                          {r.admin_note && <p className="text-xs text-[#087F73]">Note: {r.admin_note}</p>}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => openAction('report', r, 'reviewing')} className="gap-1">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Reviewing
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => openAction('report', r, 'resolved')} className="gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Resolve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openAction('report', r, 'dismissed')}>Dismiss</Button>
                          {r.target_type === 'user' && (
                            <Button size="sm" variant="danger" onClick={() => openAction('suspend', r)} className="gap-1">
                              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> Suspend member
                            </Button>
                          )}
                          {r.target_type !== 'user' && (
                            <Button size="sm" variant="danger" onClick={() => openAction('cancel', r)} className="gap-1">
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Cancel Hangout
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'refunds' && (
          isLoading ? (
            <div className="h-32 bg-white border border-[#E8E6E1] rounded-2xl animate-pulse" aria-busy="true" />
          ) : payments.length === 0 ? (
            <p className="p-8 bg-white border border-[#E8E6E1] rounded-2xl text-center text-sm text-[#6F6F6F]">No refunds due.</p>
          ) : (
            <div className="overflow-x-auto bg-white border border-[#DDE3E0] rounded-2xl">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-[#6F6F6F] border-b border-[#E8E6E1]">
                  <tr>
                    <th className="p-3">Paid</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Hangout</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Why</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-[#F0EEE9] last:border-0">
                      <td className="p-3 whitespace-nowrap">{when(p.paid_at || p.created_at)}</td>
                      <td className="p-3">{p.payer_name || '—'}<div className="text-xs text-[#6F6F6F]">{p.payer_email}</div></td>
                      <td className="p-3">
                        {p.hangout_id ? <Link to={`/hangout/${p.hangout_id}`} className="underline">{p.hangout_title}</Link> : '—'}
                        <div className="text-xs text-[#6F6F6F]">{p.payment_type} · {p.hangout_status}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold">{formatMoney(p.amount, p.currency)}</td>
                      <td className="p-3 text-xs">{(p.refund_reason || '').replace(/_/g, ' ') || '—'}</td>
                      <td className="p-3 font-mono text-xs">{p.reference}</td>
                      <td className="p-3"><Button size="sm" variant="primary" onClick={() => openAction('refund', p)}>Mark refunded</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        <Modal isOpen={Boolean(action)} onClose={() => !isWorking && setAction(null)} title={actionCopy?.title}>
          <div className="space-y-4">
            {actionCopy?.body && <p className="text-sm text-[#3D4948]">{actionCopy.body}</p>}
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[#172121]">
                {action?.kind === 'refund' ? 'Paystack refund reference (required)' : 'Internal note (optional)'}
              </span>
              <textarea
                rows="3"
                maxLength={1000}
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-4 py-3 bg-[#F7F6F2] border border-[#E8E6E1] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999]"
              />
            </label>
            {actionError && <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">{actionError}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button variant="outline" size="md" fullWidth onClick={() => setAction(null)} disabled={isWorking}>Back</Button>
              <Button variant={actionCopy?.variant || 'primary'} size="md" fullWidth onClick={runAction} disabled={isWorking}>
                {isWorking ? 'Working...' : actionCopy?.confirm}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
