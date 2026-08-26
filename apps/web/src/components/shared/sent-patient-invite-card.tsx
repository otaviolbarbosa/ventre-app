"use client";

import { InviteStatusBadge } from "@/components/shared/invite-status-badge";
import { cn } from "@/lib/utils";
import type { PatientWithGestationalInfo, SentPatientInvite } from "@/types";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import dayjs from "dayjs";
import { Loader2, Send } from "lucide-react";
import { PatientCard } from "./patient-card";

type SentPatientInviteCardProps = {
  invite: SentPatientInvite;
  isActive: boolean;
  resending: boolean;
  onResend: () => void;
};

export function SentPatientInviteCard({
  invite,
  isActive,
  resending,
  onResend,
}: SentPatientInviteCardProps) {
  const canResend = invite.status !== "usado";
  const isAccepted = invite.status === "aceito";

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div
            className={cn("space-y-1 text-sm", isActive || !isAccepted ? undefined : "opacity-60")}
          >
            <div>
              <PatientCard
                patient={
                  {
                    name: invite.patient?.name ?? invite.name ?? "—",
                    avatar_url: invite.patient?.user?.avatar_url,
                    due_date: invite.patient?.pregnancies[0]?.due_date,
                    dum: invite.patient?.pregnancies[0]?.dum,
                  } as unknown as PatientWithGestationalInfo
                }
                extra={
                  invite.email && (
                    <div className="text-muted-foreground text-xs">{invite.email}</div>
                  )
                }
                noPadding
              />
            </div>
          </div>
          <InviteStatusBadge status={invite.status} />
        </div>
        {!["usado", "aceito"].includes(invite.status) && (
          <div className="flex flex-col items-start justify-between gap-2 text-sm sm:flex-row">
            <div className="text-muted-foreground">
              Expira em {dayjs(invite.expires_at).format("DD/MM/YYYY")}
            </div>
            {canResend && (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resending}
                  onClick={onResend}
                  className="w-full sm:w-auto"
                >
                  {resending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Reenviar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
