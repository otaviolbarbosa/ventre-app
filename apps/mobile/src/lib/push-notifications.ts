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

export async function requestPushPermissionAndGetToken(): Promise<string | null> {
  if (Platform.OS === "android") {
    // No-op on Android < 13; required for the OS to allow notifications on 13+.
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);
  const granted =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (!granted) return null;

  return getToken(messaging);
}

export function subscribeToTokenRefresh(onRefresh: (token: string) => void): () => void {
  return onTokenRefresh(getMessaging(), onRefresh);
}

export function subscribeToForegroundMessages(): () => void {
  return onMessage(getMessaging(), async (remoteMessage) => {
    const { title, body } = remoteMessage.notification ?? {};
    if (!title) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  });
}

export async function getInitialDeepLinkUrl(): Promise<string | null> {
  const message = await getInitialNotification(getMessaging());
  const url = message?.data?.url;
  return typeof url === "string" ? url : null;
}

export function subscribeToNotificationOpen(onOpen: (url: string) => void): () => void {
  return onNotificationOpenedApp(getMessaging(), (remoteMessage) => {
    const url = remoteMessage.data?.url;
    if (typeof url === "string") onOpen(url);
  });
}
