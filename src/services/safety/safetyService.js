/**
 * Safety & Trust Service — Handles reporting of activities, hosts, and chat members
 */

const STORAGE_KEY_REPORTS = 'leenkit_safety_reports';
const FALLBACK_STORAGE_KEY_REPORTS = 'leenq_safety_reports';

export const safetyService = {
  getReports() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPORTS) || localStorage.getItem(FALLBACK_STORAGE_KEY_REPORTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  },

  submitReport({ targetType, targetId, targetTitle, reason, description, reporterId }) {
    const newReport = {
      id: `report-${Date.now()}`,
      targetType, // 'activity', 'user', 'space'
      targetId,
      targetTitle: targetTitle || 'Item',
      reason,
      description: description ? description.trim() : '',
      reporterId: reporterId || 'anonymous',
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    const reports = this.getReports();
    reports.push(newReport);
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));

    return newReport;
  }
};
