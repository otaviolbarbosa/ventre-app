import type { Tables } from "@ventre/supabase";

export type SubscriptionRow = Tables<"subscriptions"> & {
  plan_name: string | null;
  user_name: string | null;
  user_email: string | null;
};

export type Model =
  | Tables<"enterprises">
  | Tables<"patients">
  | Tables<"users">
  | Tables<"plans">
  | SubscriptionRow;
