import type { Tables } from "@ventre/supabase/types";

type UserType = Tables<"users">["user_type"];

const STAFF_TYPES: UserType[] = ["manager", "secretary"];

/**
 * Whether the paywall should show a subscribe button. null covers a logged-out
 * visitor, who should still see pricing and get prompted to log in on click.
 * Patients never pay, admins never pay, and staff can't yet (enterprise plans
 * aren't sold) — all three see a message instead of a button.
 */
export function canPurchaseFromPaywall(userType: UserType | null): boolean {
  return userType === null || userType === "professional";
}

export function getPaywallUnavailableMessage(userType: UserType | null): string {
  if (userType === "patient") {
    return "Gestantes têm acesso gratuito ao Ventre e não precisam assinar nenhum plano.";
  }
  if (userType && STAFF_TYPES.includes(userType)) {
    return "As funcionalidades para equipes ainda estão em desenvolvimento. Assim que o plano empresarial estiver disponível, você poderá assinar por aqui.";
  }
  return "Assinatura não disponível para o seu perfil.";
}
