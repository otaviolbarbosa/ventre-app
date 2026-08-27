import { Badge } from "@ventre/ui/badge";

type InviteStatusConfig = {
  label: string;
  variant: "warning" | "success" | "destructive" | "secondary";
};

const inviteStatusConfigs: Record<string, InviteStatusConfig> = {
  pendente: { label: "Pendente", variant: "warning" },
  aceito: { label: "Aceito", variant: "success" },
  usado: { label: "Aceito", variant: "success" },
  rejeitado: { label: "Recusado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "secondary" },
};

export function getInviteStatusConfig(status: string): InviteStatusConfig {
  return inviteStatusConfigs[status] ?? { label: status, variant: "secondary" };
}

export function InviteStatusBadge({ status }: { status: string }) {
  const config = getInviteStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
