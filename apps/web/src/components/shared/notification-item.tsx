"use client";

import { cn } from "@/lib/utils";
import { dayjs } from "@/lib/dayjs";
import {
  Calendar,
  CalendarX,
  FileText,
  ClipboardPlus,
  UserPlus,
  UserCheck,
  Baby,
  Bell,
} from "lucide-react";
import type { Notification } from "@/services/notification";

const typeIcons: Record<string, typeof Bell> = {
  appointment_created: Calendar,
  appointment_updated: Calendar,
  appointment_cancelled: CalendarX,
  appointment_reminder: Calendar,
  team_invite_received: UserPlus,
  team_invite_accepted: UserCheck,
  document_uploaded: FileText,
  evolution_added: ClipboardPlus,
  dpp_approaching: Baby,
};

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || Bell;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
        !notification.is_read && "bg-primary-50/50",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          notification.is_read ? "bg-gray-100" : "bg-primary/10",
        )}
      >
        <Icon className={cn("h-4 w-4", notification.is_read ? "text-gray-500" : "text-primary")} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            notification.is_read ? "text-gray-700" : "font-medium text-gray-900",
          )}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-gray-500 text-xs">{notification.body}</p>
        <p className="mt-1 text-gray-400 text-xs">{dayjs(notification.created_at).fromNow()}</p>
      </div>
      {!notification.is_read && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
