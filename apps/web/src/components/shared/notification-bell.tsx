"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationItem } from "./notification-item";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/services/notification";

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount, markAsRead, setUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=5");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead([notification.id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
    }

    setOpen(false);
    if (notification.data?.url) {
      router.push(notification.data.url);
    }
  };

  const handleMarkAllRead = async () => {
    await markAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative bg-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="-top-0.5 -right-0.5 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-medium text-[10px] text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notificações</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-primary text-xs hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500 text-sm">
              Nenhuma notificação
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleNotificationClick(n)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="border-t px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
            className="w-full text-center text-primary text-sm hover:underline"
          >
            Ver todas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
