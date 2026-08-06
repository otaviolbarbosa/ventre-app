import { getApp, getApps, initializeApp } from "firebase/app";
import {
  type MessagePayload,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

async function getMessagingInstance() {
  if (typeof window === "undefined") return null;
  // WebViews (e.g. the mobile app) and some browsers lack IndexedDB/Service
  // Worker/Push APIs — getMessaging() throws if called without this check.
  if (!(await isSupported())) return null;
  return getMessaging(app);
}

export async function requestFcmToken(): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-cloud-messaging-push-scope",
    });

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    return token;
  } catch (err) {
    console.error("[FCM] getToken falhou:", err);
    return null;
  }
}

export async function onForegroundMessage(callback: (payload: MessagePayload) => void) {
  const messaging = await getMessagingInstance();
  if (!messaging)
    return () => {
      /* noop */
    };
  return onMessage(messaging, callback);
}
