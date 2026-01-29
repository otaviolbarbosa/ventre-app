"use client";

import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dayjs } from "@/lib/dayjs";
import { Calendar, Check, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Invite = {
  id: string;
  professional_type: string;
  expires_at: string;
  patient: { id: string; name: string; due_date: string; gestational_week: number | null } | null;
  inviter: { name: string; professional_type: string } | null;
};

const professionalTypeLabels: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeiro(a)",
  doula: "Doula",
};

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  async function fetchInvites() {
    const response = await fetch("/api/team/invites");
    const data = await response.json();
    setInvites(data.invites || []);
    setLoading(false);
  }

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

      toast.success(action === "accept" ? "Convite aceito!" : "Convite rejeitado");
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

        {loading ? (
          <LoadingTable />
        ) : invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Nenhum convite pendente"
            description="Você não tem convites pendentes para participar de equipes."
          />
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => (
              <Card key={invite.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{invite.patient?.name}</CardTitle>
                      <CardDescription>
                        Convidado por {invite.inviter?.name} (
                        {professionalTypeLabels[invite.inviter?.professional_type || ""]})
                      </CardDescription>
                    </div>
                    <Badge>{professionalTypeLabels[invite.professional_type]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {/* {invite.patient?.gestational_week && (
                        <div className="flex items-center gap-1">
                          <Baby className="h-4 w-4" />
                          <span>{invite.patient.gestational_week} semanas</span>
                        </div>
                      )} */}
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
                        size="sm"
                        onClick={() => handleAction(invite.id, "reject")}
                        disabled={processingId === invite.id}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Recusar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(invite.id, "accept")}
                        disabled={processingId === invite.id}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Aceitar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
