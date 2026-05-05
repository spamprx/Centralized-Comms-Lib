import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { profileService } from './profileService';

const DEVICE_ID_STORAGE_KEY = 'comms.device.id';
const MESSAGING_SW_URL = '/api/v1/firebase-messaging-sw.js';

type FirebaseLikeError = {
  code?: string;
  message?: string;
  name?: string;
};

export type PushMessage = {
  title: string;
  body: string;
};

function toReadableError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  const e = err as FirebaseLikeError;
  const code = typeof e?.code === 'string' ? e.code : undefined;
  const message =
    typeof e?.message === 'string' ? e.message : 'Unknown push registration failure';
  return new Error(code ? `[${code}] ${message}` : message);
}

function hintForPushError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid-vapid-key')) {
    return 'Invalid VAPID key. Verify FIREBASE_WEB_PUSH_VAPID_KEY for the same Firebase project.';
  }
  if (m.includes('token-subscribe-failed') || m.includes('push service error')) {
    return 'Push service rejected token subscription. Confirm Firebase Cloud Messaging API and Firebase Installations API are enabled, and the Firebase config + VAPID key belong to the same project.';
  }
  if (m.includes('permission-blocked') || m.includes('permission denied')) {
    return 'Browser notification permission is blocked for this origin.';
  }
  return 'Check Firebase project configuration and browser notification permissions.';
}

function getOrCreateDeviceId(): string {
  const existing = globalThis.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const next = crypto.randomUUID();
  globalThis.localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServiceWorkerScript(
  maxAttempts = 8,
  delayMs = 750,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(MESSAGING_SW_URL, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (res.ok) return;
    } catch {
      // Retry while backend/container boot settles.
    }
    await sleep(delayMs);
  }
  throw new Error(
    'Service worker script is temporarily unavailable (backend may still be starting)',
  );
}

export const pushNotificationService = {
  subscribeToMessages(onReceive: (message: PushMessage) => void): () => void {
    const swHandler = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      const payload = (event.data as { payload?: { title?: string; body?: string } } | null)?.payload;
      if (type !== 'push-received') return;
      const title = payload?.title?.trim() || 'New update';
      const body = payload?.body?.trim() || '';
      if (!body) return;
      onReceive({ title, body });
    };
    navigator.serviceWorker?.addEventListener('message', swHandler);

    let unsubscribeFirebase = () => {};
    void (async () => {
      try {
        if (!(await isSupported())) return;
        const firebase = await profileService.getFirebaseClientConfig();
        const app = getApps().length > 0 ? getApp() : initializeApp(firebase.config);
        const messaging = getMessaging(app);
        unsubscribeFirebase = onMessage(messaging, (payload) => {
          const title = payload.notification?.title?.trim() || 'New update';
          const body = payload.notification?.body?.trim() || '';
          if (!body) return;
          onReceive({ title, body });
        });
      } catch {
        // Non-fatal: message stream unavailable until push is enabled/configured.
      }
    })();

    return () => {
      navigator.serviceWorker?.removeEventListener('message', swHandler);
      unsubscribeFirebase();
    };
  },

  async enableForCurrentDevice(): Promise<{ deviceId: string; token: string }> {
    try {
      if (!('Notification' in globalThis) || !('serviceWorker' in navigator)) {
        throw new Error('Push notifications are not supported in this browser');
      }
      if (!(await isSupported())) {
        throw new Error('Firebase messaging is not supported in this browser');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was denied');
      }

      await waitForServiceWorkerScript();

      const firebase = await profileService.getFirebaseClientConfig();
      const app = getApps().length > 0 ? getApp() : initializeApp(firebase.config);
      const registration = await navigator.serviceWorker.register(MESSAGING_SW_URL, {
        scope: '/',
      });
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: firebase.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token?.trim()) {
        throw new Error('Failed to generate FCM token for this device');
      }

      const deviceId = getOrCreateDeviceId();
      await profileService.registerDeviceFcmToken({
        token,
        deviceId,
      });

      return {
        deviceId,
        token,
      };
    } catch (err) {
      const readable = toReadableError(err);
      const withHint = `${readable.message} ${hintForPushError(readable.message)}`;
      throw new Error(withHint);
    }
  },
};
