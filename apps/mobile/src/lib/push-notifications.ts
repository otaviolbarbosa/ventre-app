import { Platform, PermissionsAndroid } from "react-native";
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";

export type PushPlatform = "ios" | "android";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function getPushPlatform(): PushPlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

// getMessaging() throws synchronously if the native Firebase app isn't
// initialized yet (e.g. google-services.json/GoogleService-Info.plist is
// missing, or app.json's config plugins haven't been baked into a native
// prebuild). Push notifications are additive — the WebView shell must keep
// working even when Firebase isn't configured, not crash on mount.
function getMessagingSafely(): ReturnType<typeof getMessaging> | null {
  try {
    return getMessaging();
  } catch (err) {
    console.warn("[push] Firebase Messaging unavailable:", err);
    return null;
  }
}

// Returned in place of a real unsubscribe function when Firebase Messaging
// is unavailable, so callers can always call the returned cleanup as-is.
function noopUnsubscribe() {
  // Firebase Messaging unavailable — nothing to unsubscribe.
}

export async function requestPushPermissionAndGetToken(): Promise<string | null> {
  const messaging = getMessagingSafely();
  if (!messaging) return null;

  if (Platform.OS === "android") {
    // No-op on Android < 13; required for the OS to allow notifications on 13+.
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const authStatus = await requestPermission(messaging);
  const granted =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (!granted) return null;

  return getToken(messaging);
}

export function subscribeToTokenRefresh(onRefresh: (token: string) => void): () => void {
  const messaging = getMessagingSafely();
  if (!messaging) return noopUnsubscribe;
  return onTokenRefresh(messaging, onRefresh);
}

export function subscribeToForegroundMessages(): () => void {
  const messaging = getMessagingSafely();
  if (!messaging) return noopUnsubscribe;
  return onMessage(messaging, async (remoteMessage) => {
    const { title, body } = remoteMessage.notification ?? {};
    if (!title) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  });
}

export async function getInitialDeepLinkUrl(): Promise<string | null> {
  const messaging = getMessagingSafely();
  if (!messaging) return null;

  const message = await getInitialNotification(messaging);
  const url = message?.data?.url;
  return typeof url === "string" ? url : null;
}

export function subscribeToNotificationOpen(onOpen: (url: string) => void): () => void {
  const messaging = getMessagingSafely();
  if (!messaging) return noopUnsubscribe;
  return onNotificationOpenedApp(messaging, (remoteMessage) => {
    const url = remoteMessage.data?.url;
    if (typeof url === "string") onOpen(url);
  });
}
