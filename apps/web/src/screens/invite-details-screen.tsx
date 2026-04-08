"use client";

import { respondInviteAction } from "@/actions/respond-invite-action";
import { Header } from "@/components/layouts/header";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { Invite } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import dayjs from "dayjs";
import { Baby, Calendar, CheckCircle, UserPlus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type InviteDetailsScreenProps = {
  invite?: Invite;
};

export default function InviteDetailsScreen({ invite }: InviteDetailsScreenProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const { executeAsync } = useAction(respondInviteAction);

  useEffect(() => {
    if (!invite) {
      toast.error("Este convite pode ter expirado ou sido cancelado.");
      router.replace("/invites");
    }
  }, [invite, router]);

  if (!invite) return null;

  const gestationalAge = calculateGestationalAge(invite.patient?.pregnancies?.[0]?.dum ?? null);
  const inviterTypeLabel =
    professionalTypeLabels[invite.inviter?.professional_type ?? ""] ??
    invite.inviter?.professional_type;

  async function handleAction(action: "accept" | "reject") {
    if (!invite?.id) return;
    setProcessing(true);

    const result = await executeAsync({ inviteId: invite.id, action });

    if (result?.serverError) {
      toast.error(result.serverError);
      setProcessing(false);
      return;
    }

    if (action === "accept") {
      toast.success("Convite aceito! Você agora faz parte da equipe.");
      router.push(`/patients/${invite?.patient?.id}`);
    } else {
      toast.success("Convite recusado.");
      router.push("/invites");
    }
  }

  return (
    <>
      <Header title="Convite para equipe" back="/invites" />
      <div className="mx-auto flex max-w-lg flex-col justify-center p-4 pt-8 md:p-6 md:pt-12">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <p className="text-center text-sm leading-relaxed">
              <span className="font-semibold">{invite.inviter?.name}</span>
              {inviterTypeLabel && (
                <span className="text-muted-foreground"> ({inviterTypeLabel})</span>
              )}{" "}
              te convidou para fazer parte da equipe de cuidado da gestante{" "}
              <span className="font-semibold">{invite.patient?.name}</span>.
            </p>

            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4 text-sm">
              {gestationalAge && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Baby className="h-4 w-4 shrink-0" />
                  <span>
                    Idade gestacional:{" "}
                    <span className="font-medium text-foreground">
                      {gestationalAge.weeks} semanas
                      {gestationalAge.days > 0 && ` e ${gestationalAge.days} dias`}
                    </span>
                  </span>
                </div>
              )}
              {invite.patient?.pregnancies?.[0]?.due_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    DPP:{" "}
                    <span className="font-medium text-foreground">
                      {dayjs(invite.patient.pregnancies[0].due_date).format("DD/MM/YYYY")}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>
                  Expira em{" "}
                  <span className="font-medium text-foreground">
                    {dayjs(invite.expires_at).format("DD/MM/YYYY")}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleAction("reject")}
                disabled={processing}
              >
                Recusar
              </Button>
              <Button
                className="gradient-primary flex-1"
                onClick={() => handleAction("accept")}
                disabled={processing}
              >
                Aceitar convite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
