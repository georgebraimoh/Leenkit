import { supabase } from '../../lib/supabase';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Fallback public VAPID key if not specified in environment
const DEFAULT_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export const pushNotificationService = {
  isPushSupported() {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  getPermissionState() {
    if (!this.isPushSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  async getSubscription() {
    if (!this.isPushSupported()) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  },

  async isUserSubscribed(userId) {
    if (!userId || !this.isPushSupported()) return false;
    try {
      const subscription = await this.getSubscription();
      if (!subscription) return false;

      const { data, error } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();

      if (error) return false;
      return Boolean(data);
    } catch {
      return false;
    }
  },

  async subscribe(userId) {
    if (!userId) throw new Error('You must be signed in to enable notifications');
    if (!this.isPushSupported()) {
      throw new Error('Push notifications are not supported on this browser or device.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission was not granted. Please allow notifications in your browser settings.');
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';

    const { error } = await supabase
      .from('user_push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent
      }, { onConflict: 'endpoint' });

    if (error) {
      throw new Error(`Failed to save notification subscription: ${error.message}`);
    }

    return subscription;
  },

  async unsubscribe(userId) {
    if (!this.isPushSupported()) return;

    try {
      const subscription = await this.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        await supabase.rpc('delete_push_subscription', {
          p_endpoint: endpoint
        });
      }
    } catch (err) {
      console.warn('Error unsubscribing from push notifications:', err);
    }
  }
};
