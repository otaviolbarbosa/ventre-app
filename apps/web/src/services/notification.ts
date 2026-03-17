import type { createServerSupabaseClient } from "@nascere/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

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

export async function markNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
  ids?: string[],
) {
  const now = new Date().toISOString();

  let query = supabase
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function getNotificationSettings() {
  const res = await fetch("/api/notifications/settings");
  if (!res.ok) throw new Error("Erro ao carregar configurações");
  return res.json() as Promise<{ settings: NotificationSettings }>;
}

export async function updateNotificationSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Partial<NotificationSettings>,
) {
  const updateData = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("notification_settings")
    .update(updateData)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as NotificationSettings;
}
