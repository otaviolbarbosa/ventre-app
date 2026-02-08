export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationSettings = {
  id: string;
  user_id: string;
  appointment_created: boolean;
  appointment_updated: boolean;
  appointment_cancelled: boolean;
  appointment_reminder: boolean;
  team_invite_received: boolean;
  team_invite_accepted: boolean;
  document_uploaded: boolean;
  evolution_added: boolean;
  dpp_approaching: boolean;
};

export async function getNotifications(page = 1, filter?: "unread") {
  const params = new URLSearchParams({ page: String(page) });
  if (filter) params.set("filter", filter);

  const res = await fetch(`/api/notifications?${params}`);
  if (!res.ok) throw new Error("Erro ao carregar notificações");
  return res.json() as Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export async function markNotificationsRead(ids?: string[]) {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Erro ao marcar notificações como lidas");
}

export async function getNotificationSettings() {
  const res = await fetch("/api/notifications/settings");
  if (!res.ok) throw new Error("Erro ao carregar configurações");
  return res.json() as Promise<{ settings: NotificationSettings }>;
}

export async function updateNotificationSettings(settings: Partial<NotificationSettings>) {
  const res = await fetch("/api/notifications/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Erro ao atualizar configurações");
  return res.json() as Promise<{ settings: NotificationSettings }>;
}
