"use client";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { Invite } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import dayjs from "dayjs";
import { Baby, Calendar, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type InvistesScreenProps = {
  invites: Invite[];
};

export default function InvitesScreen({ invites: initialInvites }: InvistesScreenProps) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleAction(inviteId: string, action: "accept" | "reject") {
    setProcessingId(inviteId);

    try {
      const response = await fetch(`/api/team/invites/${inviteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao processar convite");
      }

      if (action === "accept") {
        const invite = invites.find((i) => i.id === inviteId);
        toast.success("Convite aceito!", {
          action: invite?.patient
            ? {
                label: `Ver ${invite.patient.name}`,
                onClick: () => {
                  window.location.href = `/patients/${invite.patient?.id}`;
                },
              }
            : undefined,
        });
      } else {
        toast.success("Convite rejeitado");
      }

      setInvites(invites.filter((i) => i.id !== inviteId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar convite");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div>
      <Header title="Convites" />
      <div className="p-4 pt-0 md:p-6">
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
              const gestationalAge = calculateGestationalAge(invite.patient?.dum);

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
                        {invite.patient?.dum && (
                          <div className="flex items-center gap-1">
                            <Baby className="h-4 w-4" />
                            <span>
                              {gestationalAge?.weeks} semanas{" "}
                              {gestationalAge?.days ? `e ${gestationalAge.days} dias` : null}
                            </span>
                          </div>
                        )}
                        {invite.patient?.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>DPP: {dayjs(invite.patient.due_date).format("DD/MM/YYYY")}</span>
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
