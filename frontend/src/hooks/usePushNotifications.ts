import { useEffect } from 'react';
import { User } from '@/types';
import { getSession } from '@/lib/api';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const pad    = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64    = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw    = atob(b64);
  const bytes  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function usePushNotifications(user: User | null) {
  useEffect(() => {
    if (!user || !VAPID_PUBLIC_KEY) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        if (Notification.permission === 'denied') return;

        const permission = Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
        if (permission !== 'granted') return;

        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly:    true,
          applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const p256dh = sub.getKey('p256dh');
        const auth   = sub.getKey('auth');
        if (!p256dh || !auth) return;

        const session = getSession();
        if (!session?.access_token) return;

        const toBase64 = (buf: ArrayBuffer) => {
          const bytes = new Uint8Array(buf);
          let str = '';
          for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
          return btoa(str);
        };

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/push/subscribe`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh:   toBase64(p256dh),
            auth:     toBase64(auth),
          }),
        });
      } catch {
        /* silent — push is best-effort */
      }
    })();
  }, [user?.id]); // eslint-disable-line
}
