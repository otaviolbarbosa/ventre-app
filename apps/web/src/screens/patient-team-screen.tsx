"use client";

import { getPatientAction } from "@/actions/get-patient-action";
import { getPatientPendingInvitesAction } from "@/actions/get-patient-pending-invites-action";
import { getTeamMembersAction } from "@/actions/get-team-members-action";
import { leaveTeamAction } from "@/actions/leave-team-action";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPatientTeam } from "@/components/shared/loading-state";
import PendingInviteCard from "@/components/shared/pending-invite-card";
import TeamMemberCard from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import AddBackupProfessionalModal from "@/modals/add-backup-professional-modal";
import InviteProfessionalModal from "@/modals/invite-professional-modal";
import type { ProfessionalType } from "@/types";
import { ShieldAlert, UserMinus, UserPlus, Users } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { redirect, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PatientTeamScreen() {
  const params = useParams();
  const { user, isStaff } = useAuth();
  const patientId = params.id as string;

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const {
    execute: fetchPatient,
    result: patientResult,
    status: patientStatus,
  } = useAction(getPatientAction);
  const {
    execute: fetchTeamMembers,
    result: teamResult,
    status: teamStatus,
  } = useAction(getTeamMembersAction);
  const {
    execute: fetchPendingInvites,
    result: invitesResult,
  } = useAction(getPatientPendingInvitesAction);

  // biome-ignore lint/correctness/useExhaustiveDependencies: execute functions are stable
  useEffect(() => {
    fetchPatient({ patientId });
    fetchTeamMembers({ patientId });
    fetchPendingInvites({ patientId });
  }, [patientId]);

  const { execute: executeLeaveTeam, status: leaveStatus } = useAction(leaveTeamAction, {
    onSuccess: () => {
      toast.success("Você saiu da equipe");
      redirect("/patients");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao sair da equipe");
      setLeaveDialogOpen(false);
    },
  });

  const patient = patientResult.data?.patient ?? null;
  const teamMembers = teamResult.data?.teamMembers ?? [];
  const loading =
    ["idle", "executing"].includes(patientStatus) || ["idle", "executing"].includes(teamStatus);
  const patientOwnerId = patient?.created_by;
  const isLeaving = leaveStatus === "executing";

  const currentUserMember = teamMembers.find((m) => m.professional_id === user?.id);

  function handleLeaveTeam() {
    if (!user?.id) return;
    executeLeaveTeam({ patientId });
  }

  if (loading) return <LoadingPatientTeam />;
  if (!patient) return null;

  const ROLE_ORDER: ProfessionalType[] = ["obstetra", "enfermeiro", "doula"];

  const primaryByType = Object.fromEntries(
    ROLE_ORDER.map((role) => [
      role,
      teamMembers.find((m) => m.professional_type === role && !m.is_backup),
    ]),
  ) as Record<ProfessionalType, (typeof teamMembers)[0] | undefined>;

  const backupByType = Object.fromEntries(
    ROLE_ORDER.map((role) => [
      role,
      teamMembers.find((m) => m.professional_type === role && m.is_backup),
    ]),
  ) as Record<ProfessionalType, (typeof teamMembers)[0] | undefined>;

  const rawInvites = invitesResult.data?.invites ?? [];
  const pendingInviteByType = Object.fromEntries(
    ROLE_ORDER.map((role) => [
      role,
      rawInvites.find((inv) => {
        const professional = Array.isArray(inv.invited_professional)
          ? inv.invited_professional[0]
          : inv.invited_professional;
        const resolvedType = inv.professional_type ?? professional?.professional_type;
        return resolvedType === role;
      }),
    ]),
  ) as Record<ProfessionalType, (typeof rawInvites)[0] | undefined>;

  const activeRoles = ROLE_ORDER.filter(
    (role) => primaryByType[role] || pendingInviteByType[role],
  );

  const usedTypes = teamMembers.filter((m) => !m.is_backup).map((m) => m.professional_type);
  const availableTypes = ROLE_ORDER.filter((t) => !usedTypes.includes(t));
  const isUserInTeam = teamMembers.some((m) => m.professional_id === user?.id);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Equipe de Cuidado</h2>
          <div className="flex gap-2">
            {isUserInTeam && (
              <Button variant="outline" onClick={() => setLeaveDialogOpen(true)}>
                <UserMinus className="mr-2 h-4 w-4" />
                <span className="hidden sm:block">Sair da Equipe</span>
                <span className="block sm:hidden">Sair</span>
              </Button>
            )}
            {availableTypes.length > 0 && (
              <>
                <Button
                  size="icon"
                  className="gradient-primary flex md:hidden"
                  onClick={() => setIsInviteOpen(true)}
                >
                  <UserPlus />
                </Button>
                <Button
                  className="gradient-primary hidden md:flex"
                  onClick={() => setIsInviteOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="ml-2">Convidar</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {teamMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Equipe vazia"
            description="Nenhum profissional está associado a esta paciente ainda."
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden grid-cols-2 gap-4 px-1 sm:grid">
              <p className="font-medium text-muted-foreground text-sm">Equipe Titular</p>
              <p className="font-medium text-muted-foreground text-sm">Equipe Backup</p>
            </div>
            {activeRoles.map((role) => {
              const primary = primaryByType[role];
              const backup = backupByType[role];
              const pendingInvite = pendingInviteByType[role];
              const canAddBackupForRole =
                isStaff ||
                (currentUserMember?.professional_type === role &&
                  !currentUserMember.is_backup &&
                  !backup);

              const pendingProfessional = pendingInvite
                ? Array.isArray(pendingInvite.invited_professional)
                  ? pendingInvite.invited_professional[0]
                  : pendingInvite.invited_professional
                : null;

              return (
                <div key={role} className="grid gap-4 sm:grid-cols-2">
                  {primary ? (
                    <TeamMemberCard
                      member={primary}
                      isOwner={patientOwnerId === primary.professional?.id}
                      onRemoved={() => fetchTeamMembers({ patientId })}
                    />
                  ) : pendingProfessional ? (
                    <PendingInviteCard
                      name={pendingProfessional.name}
                      email={pendingProfessional.email}
                      avatarUrl={pendingProfessional.avatar_url}
                      professionalType={
                        (pendingInvite?.professional_type ??
                          pendingProfessional.professional_type) as string
                      }
                    />
                  ) : null}
                  {backup ? (
                    <TeamMemberCard
                      member={backup}
                      isOwner={patientOwnerId === backup.professional?.id}
                      onRemoved={() => fetchTeamMembers({ patientId })}
                    />
                  ) : canAddBackupForRole ? (
                    <button
                      type="button"
                      onClick={() => setIsBackupOpen(true)}
                      className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground text-sm transition-colors hover:border-primary hover:text-primary"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Adicionar profissional backup
                    </button>
                  ) : (
                    <div className="hidden min-h-[72px] w-full items-center justify-center rounded-lg border border-dashed sm:flex">
                      <p className="text-muted-foreground text-sm">Profissional sem backup</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Sair da equipe"
        description="Tem certeza que deseja sair da equipe desta paciente? Você perderá acesso aos dados e agendamentos."
        confirmLabel="Sair"
        variant="destructive"
        loading={isLeaving}
        onConfirm={handleLeaveTeam}
      />

      <InviteProfessionalModal
        patient={patient}
        availableTypes={availableTypes}
        isOpen={isInviteOpen}
        setIsOpen={setIsInviteOpen}
      />

      {currentUserMember && (
        <AddBackupProfessionalModal
          patientId={patientId}
          professionalType={currentUserMember.professional_type}
          isOpen={isBackupOpen}
          setIsOpen={setIsBackupOpen}
          onSuccess={() => fetchTeamMembers({ patientId })}
        />
      )}
    </>
  );
}
