"use client";
import { respondInviteAction } from "@/actions/respond-invite-action";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { Invite } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import dayjs from "dayjs";
import { Baby, Calendar, Mail } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { redirect } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type InvistesScreenProps = {
  invites: Invite[];
};

export default function InvitesScreen({ invites: initialInvites }: InvistesScreenProps) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { executeAsync } = useAction(respondInviteAction);

  async function handleAction(inviteId: string, action: "accept" | "reject") {
    setProcessingId(inviteId);

    const result = await executeAsync({ inviteId, action });

    if (result?.serverError) {
      toast.error(result.serverError);
      setProcessingId(null);
      return;
    }

    if (action === "accept") {
      const invite = invites.find((i) => i.id === inviteId);
      toast.success("Convite aceito!", {
        action: invite?.patient
          ? {
              label: `Ver perfil de ${invite.patient.name.split(" ")[0]}`,
              onClick: () => {
                redirect(`/patients/${invite.patient?.id}`);
              },
            }
          : undefined,
      });
    } else {
      toast.success("Convite rejeitado");
    }

    setInvites(invites.filter((i) => i.id !== inviteId));
    setProcessingId(null);
  }

  return (
    <div>
      <Header title="Convites" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="Convites recebidos para participar de equipes" />

        {invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Nenhum convite pendente"
            description="Você não tem convites pendentes para participar de equipes."
          />
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => {
              const gestationalAge = calculateGestationalAge(
                invite.patient?.pregnancies?.[0]?.dum ?? null,
              );

              return (
                <Card key={invite.id}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <div>
                          Enviado por: <span className="font-semibold">{invite.inviter?.name}</span>
                        </div>
                        <Badge variant="outline">
                          {professionalTypeLabels[invite.inviter?.professional_type || ""]}
                        </Badge>
                      </div>
                      <div>
                        Gestante: <span className="font-semibold">{invite.patient?.name}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-1 text-muted-foreground text-sm sm:gap-4">
                        {invite.patient?.pregnancies?.[0]?.dum && (
                          <div className="flex items-center gap-1">
                            <Baby className="h-4 w-4" />
                            <span>
                              {gestationalAge?.weeks} semanas{" "}
                              {gestationalAge?.days ? `e ${gestationalAge.days} dias` : null}
                            </span>
                          </div>
                        )}
                        {invite.patient?.pregnancies?.[0]?.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              DPP:{" "}
                              {dayjs(invite.patient.pregnancies[0].due_date).format("DD/MM/YYYY")}
                            </span>
                          </div>
                        )}
                        <span>Expira em {dayjs(invite.expires_at).format("DD/MM/YYYY")}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleAction(invite.id, "reject")}
                          disabled={processingId === invite.id}
                          className="flex-1"
                        >
                          Recusar
                        </Button>
                        <Button
                          onClick={() => handleAction(invite.id, "accept")}
                          disabled={processingId === invite.id}
                          className="gradient-primary flex-1"
                        >
                          Aceitar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
