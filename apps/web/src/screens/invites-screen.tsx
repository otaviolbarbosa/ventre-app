"use client";
import { reactivateTeamInviteAction } from "@/actions/reactivate-team-invite-action";
import { respondInviteAction } from "@/actions/respond-invite-action";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { ReceivedInviteCard } from "@/components/shared/received-invite-card";
import { SentPatientInviteCard } from "@/components/shared/sent-patient-invite-card";
import { SentTeamInviteCard } from "@/components/shared/sent-team-invite-card";
import PatientInviteShareModal from "@/modals/patient-invite-share-modal";
import ResendTeamInviteModal from "@/modals/resend-team-invite-modal";
import type { Invite, SentPatientInvite, SentTeamInvite } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";
import { Baby, Mail, UserPlus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type InviteBucket<T> = { active: T[]; inactive: T[] };

type InvitesScreenProps = {
  received: InviteBucket<Invite>;
  sentTeam: InviteBucket<SentTeamInvite>;
  sentPatient: InviteBucket<SentPatientInvite>;
};

export default function InvitesScreen({ received, sentTeam, sentPatient }: InvitesScreenProps) {
  const router = useRouter();

  // Recebidos — unchanged local-filter pattern
  const [receivedActive, setReceivedActive] = useState<Invite[]>(received.active);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { executeAsync: executeRespond } = useAction(respondInviteAction);

  async function handleRespond(inviteId: string, action: "accept" | "reject") {
    setProcessingId(inviteId);
    const result = await executeRespond({ inviteId, action });

    if (result?.serverError) {
      toast.error(result.serverError);
      setProcessingId(null);
      return;
    }

    if (action === "accept") {
      const invite = receivedActive.find((i) => i.id === inviteId);
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

    setReceivedActive(receivedActive.filter((i) => i.id !== inviteId));
    setProcessingId(null);
  }

  // Enviados — resend via router.refresh()
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [shareModalInvite, setShareModalInvite] = useState<SentTeamInvite | null>(null);
  const [patientShareModalInvite, setPatientShareModalInvite] = useState<SentPatientInvite | null>(
    null,
  );

  const { executeAsync: executeReactivateTeam } = useAction(reactivateTeamInviteAction);

  async function handleResendTeam(invite: SentTeamInvite) {
    setResendingId(invite.id);

    if (invite.status === "expirado") {
      const result = await executeReactivateTeam({ inviteId: invite.id });

      if (result?.serverError) {
        toast.error(result.serverError);
        setResendingId(null);
        return;
      }

      router.refresh();
    }

    setResendingId(null);
    setShareModalInvite(invite);
  }

  function handleResendPatient(invite: SentPatientInvite) {
    setPatientShareModalInvite(invite);
  }

  const [acceptedInvites, expiredRejectedInvites] = sentTeam.inactive.reduce<
    [SentTeamInvite[], SentTeamInvite[]]
  >(
    ([accepted, expiredRejected], inactiveInvite) => {
      if (inactiveInvite.status === "aceito") {
        accepted.push(inactiveInvite);
      } else {
        expiredRejected.push(inactiveInvite);
      }
      return [accepted, expiredRejected];
    },
    [[], []],
  );

  return (
    <div>
      <Header title="Convites" />
      <div className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
        <div className="text-muted-foreground">
          Gerencie seus convites enviados e recebidos para gestantes e profissionais
        </div>

        <Tabs defaultValue="professionals">
          <TabsList className="mb-4 w-full max-w-xs">
            <TabsTrigger value="professionals">
              Profissionais
              {receivedActive.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                  {receivedActive.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="patients">Gestantes</TabsTrigger>
          </TabsList>

          <TabsContent value="professionals" className="space-y-8">
            <section className="space-y-4">
              <h2 className="font-poppins font-semibold text-lg">Recebidos</h2>
              {receivedActive.length === 0 && received.inactive.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="Nenhum convite pendente"
                  description="Você não tem convites pendentes para participar de equipes."
                />
              ) : (
                <>
                  {receivedActive.length > 0 && (
                    <div className="space-y-4">
                      {receivedActive.map((invite) => (
                        <ReceivedInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive
                          processing={processingId === invite.id}
                          onAccept={() => handleRespond(invite.id, "accept")}
                          onReject={() => handleRespond(invite.id, "reject")}
                        />
                      ))}
                    </div>
                  )}
                  {received.inactive.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium font-poppins text-muted-foreground text-sm">
                        Finalizados
                      </h3>
                      {received.inactive.map((invite) => (
                        <ReceivedInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive={false}
                          processing={false}
                          onAccept={() => {}}
                          onReject={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="font-poppins font-semibold text-lg">Enviados</h2>
              {sentTeam.active.length === 0 && sentTeam.inactive.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="Nenhum convite enviado"
                  description="Convites para profissionais integrarem equipes de cuidado aparecerão aqui."
                />
              ) : (
                <>
                  <div className="space-y-4">
                    {sentTeam.active.map((invite) => (
                      <SentTeamInviteCard
                        key={invite.id}
                        invite={invite}
                        isActive
                        resending={resendingId === invite.id}
                        onResend={() => handleResendTeam(invite)}
                      />
                    ))}
                  </div>
                  {acceptedInvites.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-muted-foreground text-sm">Aceitos</h3>
                      {acceptedInvites.map((invite) => (
                        <SentTeamInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive={false}
                          resending={resendingId === invite.id}
                          onResend={() => handleResendTeam(invite)}
                        />
                      ))}
                    </div>
                  )}
                  {expiredRejectedInvites.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium font-poppins text-muted-foreground text-sm">
                        Finalizados
                      </h3>
                      {expiredRejectedInvites.map((invite) => (
                        <SentTeamInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive={false}
                          resending={resendingId === invite.id}
                          onResend={() => handleResendTeam(invite)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </TabsContent>

          <TabsContent value="patients" className="space-y-6">
            {sentPatient.active.length === 0 && sentPatient.inactive.length === 0 ? (
              <EmptyState
                icon={Baby}
                title="Nenhum convite enviado"
                description="Convites para gestantes se autocadastrarem aparecerão aqui."
              />
            ) : (
              <>
                <div className="space-y-4">
                  {sentPatient.active.map((invite) => (
                    <SentPatientInviteCard
                      key={invite.id}
                      invite={invite}
                      isActive
                      resending={false}
                      onResend={() => handleResendPatient(invite)}
                    />
                  ))}
                </div>
                {sentPatient.inactive.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-muted-foreground text-sm">Finalizados</h3>
                    {sentPatient.inactive.map((invite) => (
                      <SentPatientInviteCard
                        key={invite.id}
                        invite={invite}
                        isActive={false}
                        resending={false}
                        onResend={() => handleResendPatient(invite)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {shareModalInvite && (
        <ResendTeamInviteModal
          inviteId={shareModalInvite.id}
          patientName={shareModalInvite.patient?.name ?? "a paciente"}
          isReactivated={shareModalInvite.status === "expirado"}
          isOpen={!!shareModalInvite}
          setIsOpen={(open) => !open && setShareModalInvite(null)}
        />
      )}

      {patientShareModalInvite && (
        <PatientInviteShareModal
          inviteId={patientShareModalInvite.id}
          patientName={
            patientShareModalInvite.patient?.name ?? patientShareModalInvite.name ?? "a paciente"
          }
          isOpen={!!patientShareModalInvite}
          setIsOpen={(open) => !open && setPatientShareModalInvite(null)}
          onClose={() => router.refresh()}
        />
      )}
    </div>
  );
}
