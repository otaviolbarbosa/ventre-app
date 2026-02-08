import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function getMessagingInstance() {
  if (typeof window === "undefined") return null;
  return getMessaging(app);
}

export async function requestFcmToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    return token;
  } catch {
    return null;
  }
}

export function onForegroundMessage(callback: (payload: MessagePayload) => void) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {
    /* noop */
  };
  return onMessage(messaging, callback);
}
