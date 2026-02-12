"use client";

import { Header } from "@/components/layouts/header";
import { NotificationItem } from "@/components/shared/notification-item";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/services/notification";
import { BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function NotificationsPage() {
  const router = useRouter();
  const { markAsRead, setUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filter === "unread") params.set("filter", "unread");

      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead([notification.id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
    }

    if (notification.data?.url) {
      router.push(notification.data.url);
    }
  };

  const handleMarkAllRead = async () => {
    await markAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <Header title="Notificações" back />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter("all");
                setPage(1);
              }}
            >
              Todas
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter("unread");
                setPage(1);
              }}
            >
              Não lidas
            </Button>
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-primary text-sm hover:underline"
          >
            Marcar todas como lidas
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border bg-white">
          {loading ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <div key={`skeleton-${i}`} className="animate-pulse px-4 py-3">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BellOff className="mb-3 h-10 w-10 text-gray-300" />
              <p className="font-medium text-gray-500 text-sm">Nenhuma notificação</p>
              <p className="mt-1 text-gray-400 text-xs">
                {filter === "unread"
                  ? "Todas as notificações foram lidas."
                  : "Você ainda não recebeu notificações."}
              </p>
            </div>
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-gray-500 text-sm">
              {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
