"use client";

import { useAuth } from "@/hooks/use-auth";
import { requestFcmToken, onForegroundMessage } from "@/lib/firebase/client";
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
      try {
        const res = await fetch("/api/notifications?unread_count=true");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        // silently fail
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

    try {
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fcm_token: token,
          device_info: { userAgent: navigator.userAgent },
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        localStorage.setItem("nascere_push_subscribed", "true");
        return true;
      }
    } catch {
      // silently fail
    }
    return false;
  }, []);

  const unsubscribe = useCallback(async () => {
    const token = await requestFcmToken();
    if (!token) return;

    try {
      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcm_token: token }),
      });
    } catch {
      // silently fail
    }

    setIsSubscribed(false);
    localStorage.removeItem("nascere_push_subscribed");
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

    const alreadySubscribed = localStorage.getItem("nascere_push_subscribed") === "true";
    setIsSubscribed(alreadySubscribed);

    if (Notification.permission === "granted") {
      subscribe();
    }
  }, [user, subscribe]);

  const markAsRead = useCallback(
    async (ids?: string[]) => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (res.ok) {
          if (ids) {
            setUnreadCount((c) => Math.max(0, c - ids.length));
          } else {
            setUnreadCount(0);
          }
        }
      } catch {
        // silently fail
      }
    },
    [],
  );

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
