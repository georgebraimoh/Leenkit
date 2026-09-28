import { supabase } from '../../lib/supabase';

function formatNotification(dbItem) {
  if (!dbItem) return null;
  return {
    id: dbItem.id,
    userId: dbItem.user_id,
    actorId: dbItem.actor_id,
    hangoutId: dbItem.hangout_id,
    type: dbItem.type || 'vibe_hangout',
    title: dbItem.title || 'Notification',
    message: dbItem.message || '',
    isRead: Boolean(dbItem.is_read),
    createdAt: dbItem.created_at
  };
}

export const notificationService = {
  formatNotification,

  /**
   * Fetch all notifications for the authenticated user.
   */
  async fetchNotifications(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch notifications from Supabase:', error.message);
      return [];
    }

    return (data || []).map(formatNotification).filter(Boolean);
  },

  /**
   * Mark a single notification as read in Supabase.
   */
  async markAsRead(notificationId) {
    if (!notificationId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.warn('Could not mark notification as read:', error.message);
    }
  },

  /**
   * Mark all unread notifications as read for a user.
   */
  async markAllAsRead(userId) {
    if (!userId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.warn('Could not mark all notifications as read:', error.message);
    }
  },

  /**
   * Subscribe to realtime notification events for the current user.
   */
  subscribeToNotifications(userId, onNotificationReceived) {
    if (!userId || typeof onNotificationReceived !== 'function') {
      return () => {};
    }

    const channelName = `user-notifications:${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new) {
            const formatted = formatNotification(payload.new);
            if (formatted) {
              onNotificationReceived(formatted);
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`[LEENKIT Realtime] Notification channel error for user ${userId}:`, err || status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
