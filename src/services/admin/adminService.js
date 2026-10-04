import { supabase } from '../../lib/supabase';

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export const adminService = {
  async overview() {
    const rows = unwrap(await supabase.rpc('admin_overview'));
    const r = (rows || [])[0] || {};
    return {
      pendingReports: Number(r.pending_reports || 0),
      refundsDue: Number(r.refunds_due || 0),
      suspendedUsers: Number(r.suspended_users || 0),
      payoutAccounts: Number(r.payout_accounts || 0),
      feesCollectedNgn: Number(r.fees_collected_ngn || 0)
    };
  },

  async listReports(status = null) {
    return unwrap(await supabase.rpc('admin_list_reports', { p_status: status })) || [];
  },

  async updateReport(reportId, status, note) {
    unwrap(await supabase.rpc('admin_update_report', { p_report_id: reportId, p_status: status, p_note: note || null }));
  },

  async setSuspension(userId, suspend, reason) {
    unwrap(await supabase.rpc('admin_set_suspension', { p_user_id: userId, p_suspend: suspend, p_reason: reason || null }));
  },

  async cancelHangout(hangoutId) {
    unwrap(await supabase.rpc('admin_cancel_hangout', { p_hangout_id: hangoutId }));
  },

  async listPayments(status = 'requires_refund') {
    return unwrap(await supabase.rpc('admin_list_payments', { p_status: status })) || [];
  },

  async markRefunded(paymentId, note) {
    unwrap(await supabase.rpc('admin_mark_refunded', { p_payment_id: paymentId, p_note: note || null }));
  },

  async retryRefund(paymentId) {
    unwrap(await supabase.rpc('admin_retry_refund', { p_payment_id: paymentId }));
  },

  async listPayouts(status = null) {
    return unwrap(await supabase.rpc('admin_list_payouts', { p_status: status })) || [];
  },

  async retryPayout(payoutId) {
    unwrap(await supabase.rpc('admin_retry_payout', { p_payout_id: payoutId }));
  }
};
