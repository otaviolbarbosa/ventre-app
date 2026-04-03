"use client";

import { getUnreadNotificationsCountAction } from "@/actions/get-unread-notifications-count-action";
import { markNotificationsReadAction } from "@/actions/mark-notifications-read-action";
import { subscribeNotificationsAction } from "@/actions/subscribe-notifications-action";
import { unsubscribeNotificationsAction } from "@/actions/unsubscribe-notifications-action";
import { useAuth } from "@/hooks/use-auth";
import { onForegroundMessage, requestFcmToken } from "@/lib/firebase/client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function useNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
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

  // Listen for foreground messages
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      if (title) {
        toast(title, { description: body });
        setUnreadCount((c) => c + 1);
      }
    });

    return unsubscribe;
  }, [user]);

  const subscribe = useCallback(async () => {
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
    const token = await requestFcmToken();
    if (!token) return;

    await unsubscribeNotificationsAction({ fcmToken: token });

    setIsSubscribed(false);
    localStorage.removeItem("ventre_push_subscribed");
  }, []);

  const requestPermission = useCallback(async () => {
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
    if (typeof window === "undefined" || !user) return;
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
