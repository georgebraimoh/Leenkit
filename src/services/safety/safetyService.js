/**
 * Safety & Trust Service — submits reports about Hangouts, profiles and
 * Hangout Spaces to the server-side safety_reports table.
 *
 * Reports are insert-only for signed-in users (see the safety_reports
 * migration): clients cannot read, change or delete any report.
 */
import { supabase } from '../../lib/supabase';

const TARGET_TYPES = ['activity', 'user', 'space'];

export const safetyService = {
  async submitReport({ targetType, targetId, reason, description }) {
    if (!TARGET_TYPES.includes(targetType) || !targetId) {
      throw new Error('This item cannot be reported right now.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Please choose a reason for your report.');
    }

    const trimmedDescription = description ? description.trim().slice(0, 2000) : '';

    // Insert without returning the row: reporters have no SELECT access.
    // reporter_id, status and created_at are set by the database.
    const { error } = await supabase.from('safety_reports').insert({
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim(),
      description: trimmedDescription || null
    });

    if (error) {
      throw new Error('Your report could not be submitted. Please try again.');
    }
  }
};
