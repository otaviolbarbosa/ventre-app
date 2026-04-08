"use client";

import { getNotificationsAction } from "@/actions/get-notifications-action";
import { markNotificationsReadAction } from "@/actions/mark-notifications-read-action";
import { useNotificationsContext } from "@/providers/notifications-provider";
import type { Notification } from "@/services/notification";
import { Button } from "@ventre/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ventre/ui/popover";
import { Bell } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationItem } from "./notification-item";

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount, setUnreadCount } = useNotificationsContext();
  const [open, setOpen] = useState(false);

  const { execute: fetchNotifications, result } = useAction(getNotificationsAction);
  const { executeAsync: markRead } = useAction(markNotificationsReadAction);

  useEffect(() => {
    if (open) fetchNotifications({ page: 1, limit: 5, filter: "all" });
  }, [open, fetchNotifications]);

  const notifications = (result.data?.notifications ?? []) as Notification[];

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markRead({ ids: [notification.id] });
      fetchNotifications({ page: 1, limit: 5, filter: "all" });
    }

    setOpen(false);
    if (notification.data?.url) {
      router.push(notification.data.url);
    }
  };

  const handleMarkAllRead = async () => {
    await markRead({ ids: undefined });
    fetchNotifications({ page: 1, limit: 5, filter: "all" });
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
            <p className="px-4 py-8 text-center text-gray-500 text-sm">Nenhuma notificação</p>
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
        <div className="border-t px-4 py-2 text-right">
          <Button
            className="gradient-primary"
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
