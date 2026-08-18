"use client";

import { InviteStatusBadge } from "@/components/shared/invite-status-badge";
import { cn } from "@/lib/utils";
import type { Invite, PatientWithGestationalInfo } from "@/types";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import dayjs from "dayjs";
import { PatientCard } from "./patient-card";

type ReceivedInviteCardProps = {
  invite: Invite;
  isActive: boolean;
  processing: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function ReceivedInviteCard({
  invite,
  isActive,
  processing,
  onAccept,
  onReject,
}: ReceivedInviteCardProps) {
  const isAccepted = invite.status === "aceito";
  const isExpired = invite.status === "expirado";
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="space-y-2 text-sm">
          <div className="flex items-start justify-between">
            <div className={isActive || isAccepted ? undefined : "opacity-60"}>
              <PatientCard
                patient={
                  {
                    ...invite.patient,
                    due_date: invite.patient?.pregnancies?.[0]?.due_date,
                    dum: invite.patient?.pregnancies?.[0]?.dum,
                  } as unknown as PatientWithGestationalInfo
                }
                noPadding
              />
            </div>
            <InviteStatusBadge status={invite.status} />
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "text-muted-foreground text-sm",
              isActive || isAccepted ? undefined : "opacity-60",
            )}
          >
            <div>
              Enviado por <span className="font-semibold">{invite.inviter?.name}</span>
            </div>
            {!isAccepted && (
              <div className="flex flex-wrap gap-1 sm:gap-4">
                {isExpired ? "Exiprado" : "Expira"} em{" "}
                {dayjs(invite.expires_at).format("DD/MM/YYYY")}
              </div>
            )}
          </div>
          {isActive && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onReject} disabled={processing} className="flex-1">
                Recusar
              </Button>
              <Button onClick={onAccept} disabled={processing} className="gradient-primary flex-1">
                Aceitar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
