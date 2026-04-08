import type { Tables } from "@ventre/supabase";

type Enterprise = Pick<Tables<"enterprises">, "id" | "name" | "slug" | "legal_name" | "cnpj">;
export type UserWithEnterprise = Tables<"users"> & { enterprise: Enterprise | null };

export type SubscriptionRow = Tables<"subscriptions"> & {
  plan_name: string | null;
  user_name: string | null;
  user_email: string | null;
};
