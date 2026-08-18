"use client";

import { InviteStatusBadge } from "@/components/shared/invite-status-badge";
import { cn } from "@/lib/utils";
import type { SentTeamInvite } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import dayjs from "dayjs";
import { Loader2, Send } from "lucide-react";

type SentTeamInviteCardProps = {
  invite: SentTeamInvite;
  isActive: boolean;
  resending: boolean;
  onResend: () => void;
};

export function SentTeamInviteCard({
  invite,
  isActive,
  resending,
  onResend,
}: SentTeamInviteCardProps) {
  const canResend = !["aceito", "rejeitado"].includes(invite.status);
  const isAccepted = invite.status === "aceito";

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("space-y-1 text-sm", !isActive && !isAccepted && "opacity-40")}>
            <div>
              Paciente: <span className="font-semibold">{invite.patient?.name ?? "—"}</span>
            </div>
            <div>
              {invite.invitedProfessional?.name ? (
                <>
                  Enviado para:{" "}
                  <span className="font-semibold">{invite.invitedProfessional?.name}</span>
                </>
              ) : (
                <span className="font-semibold">Convite por link</span>
              )}
              {invite.invitedProfessional?.professional_type && (
                <span className="text-muted-foreground">
                  {" "}
                  ·{" "}
                  {professionalTypeLabels[invite.invitedProfessional.professional_type] ??
                    invite.invitedProfessional.professional_type}
                </span>
              )}
            </div>
          </div>
          <InviteStatusBadge status={invite.status} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!isAccepted && (
            <span
              className={cn(
                "text-muted-foreground text-sm",
                invite.status === "expirado" && "opacity-40",
              )}
            >
              {invite.status === "expirado" ? "Expirado em " : "Expira"} em{" "}
              {dayjs(invite.expires_at).format("DD/MM/YYYY")}
            </span>
          )}
          {canResend && (
            <Button variant="outline" size="sm" disabled={resending} onClick={onResend}>
              {resending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Reenviar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
