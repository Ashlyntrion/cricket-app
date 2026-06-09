import { supabase } from './supabase';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerPush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return 'unsupported';

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'denied';

    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, subscription: subscription.toJSON() },
      { onConflict: 'user_id' }
    );

    return 'granted';
  } catch (err) {
    console.error('Push registration error:', err);
    return 'unsupported';
  }
}

export async function unregisterPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return;
  const sub = await registration.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
}
