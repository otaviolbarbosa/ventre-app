"use client";

import { getUnreadNotificationsCountAction } from "@/actions/get-unread-notifications-count-action";
import { markNotificationsReadAction } from "@/actions/mark-notifications-read-action";
import { subscribeNotificationsAction } from "@/actions/subscribe-notifications-action";
import { unsubscribeNotificationsAction } from "@/actions/unsubscribe-notifications-action";
import { useAuth } from "@/hooks/use-auth";
import { onForegroundMessage, requestFcmToken } from "@/lib/firebase/client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// Set only inside apps/mobile's WebView (react-native-webview injects this global).
function isNativeBridge() {
  return typeof window !== "undefined" && "ReactNativeWebView" in window;
}

type NativePushMessage =
  | { type: "push-token"; token: string; platform: "ios" | "android" }
  | { type: "push-unsubscribe"; token: string };

function parseNativePushMessage(raw: unknown): NativePushMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "push-token" && typeof parsed.token === "string") return parsed;
    if (parsed?.type === "push-unsubscribe" && typeof parsed.token === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isNativeBridge()) return;
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Fetch unread count
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const result = await getUnreadNotificationsCountAction();
      if (result?.data) {
        setUnreadCount(result.data.unreadCount);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // Listen for foreground messages (browser only — native foreground display
  // is handled in-app by apps/mobile's RNFirebase onMessage listener).
  useEffect(() => {
    if (typeof window === "undefined" || !user || isNativeBridge()) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    onForegroundMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      if (title) {
        toast(title, { description: body });
        setUnreadCount((c) => c + 1);
      }
    }).then((unsub) => {
      if (cancelled) {
        unsub();
      } else {
        unsubscribe = unsub;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  // Native bridge: apps/mobile posts the FCM token it collected natively;
  // subscribe/unsubscribe through the same server actions the browser flow uses.
  useEffect(() => {
    if (typeof window === "undefined" || !user || !isNativeBridge()) return;

    const handleMessage = (event: MessageEvent) => {
      const message = parseNativePushMessage(event.data);
      if (!message) return;

      if (message.type === "push-token") {
        subscribeNotificationsAction({
          fcmToken: message.token,
          deviceInfo: { platform: message.platform },
        }).then((result) => {
          if (result?.data?.success) setIsSubscribed(true);
        });
      } else {
        unsubscribeNotificationsAction({ fcmToken: message.token }).then(() => {
          setIsSubscribed(false);
        });
      }
    };

    document.addEventListener("message", handleMessage as EventListener);
    return () => document.removeEventListener("message", handleMessage as EventListener);
  }, [user]);

  const subscribe = useCallback(async () => {
    if (isNativeBridge()) return false;
    const token = await requestFcmToken();
    if (!token) return false;

    const result = await subscribeNotificationsAction({
      fcmToken: token,
      deviceInfo: { userAgent: navigator.userAgent },
    });

    if (result?.data?.success) {
      setIsSubscribed(true);
      localStorage.setItem("ventre_push_subscribed", "true");
      return true;
    }
    return false;
  }, []);

  const unsubscribe = useCallback(async () => {
    if (isNativeBridge()) return;
    const token = await requestFcmToken();
    if (!token) return;

    await unsubscribeNotificationsAction({ fcmToken: token });

    setIsSubscribed(false);
    localStorage.removeItem("ventre_push_subscribed");
  }, []);

  const requestPermission = useCallback(async () => {
    if (isNativeBridge()) return false;
    if (!("Notification" in window)) return false;

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === "granted") {
      return subscribe();
    }
    return false;
  }, [subscribe]);

  // Auto-subscribe if permission already granted (refreshes FCM token)
  useEffect(() => {
    if (typeof window === "undefined" || !user || isNativeBridge()) return;
    if (!("Notification" in window)) return;

    const alreadySubscribed = localStorage.getItem("ventre_push_subscribed") === "true";
    setIsSubscribed(alreadySubscribed);

    if (Notification.permission === "granted") {
      subscribe();
    }
  }, [user, subscribe]);

  const markAsRead = useCallback(async (ids?: string[]) => {
    const result = await markNotificationsReadAction({ ids });
    if (result?.serverError) {
      console.error("[subscribe] action error:", result.serverError);
    }

    if (result?.data?.success) {
      if (ids) {
        setUnreadCount((c) => Math.max(0, c - ids.length));
      } else {
        setUnreadCount(0);
      }
    }
  }, []);

  return {
    permissionStatus,
    isSubscribed,
    unreadCount,
    requestPermission,
    subscribe,
    unsubscribe,
    markAsRead,
    setUnreadCount,
  };
}
