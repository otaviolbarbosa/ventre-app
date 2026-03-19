"use client";

import { getPatientAction } from "@/actions/get-patient-action";
import { getPatientPendingInvitesAction } from "@/actions/get-patient-pending-invites-action";
import { getTeamMembersAction } from "@/actions/get-team-members-action";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPatientTeam } from "@/components/shared/loading-state";
import PendingInviteCard from "@/components/shared/pending-invite-card";
import TeamMemberCard from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import AddBackupProfessionalModal from "@/modals/add-backup-professional-modal";
import AddProfessionalModal from "@/modals/add-professional-modal";
import type { ProfessionalType } from "@/types";
import { ShieldAlert, UserPlus, Users } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PatientTeamEnterpriseScreen() {
  const params = useParams();
  const patientId = params.id as string;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [backupRole, setBackupRole] = useState<ProfessionalType | null>(null);

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
  const { execute: fetchPendingInvites, result: invitesResult } = useAction(
    getPatientPendingInvitesAction,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: execute functions are stable
  useEffect(() => {
    fetchPatient({ patientId });
    fetchTeamMembers({ patientId });
    fetchPendingInvites({ patientId });
  }, [patientId]);

  const patient = patientResult.data?.patient ?? null;
  const teamMembers = teamResult.data?.teamMembers ?? [];
  const loading =
    ["idle", "executing"].includes(patientStatus) || ["idle", "executing"].includes(teamStatus);
  const patientOwnerId = patient?.created_by;

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

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Equipe de Cuidado</h2>
          <div className="flex gap-2">
            <Button
              size="icon"
              className="gradient-primary flex md:hidden"
              onClick={() => setIsAddOpen(true)}
            >
              <UserPlus />
            </Button>
            <Button
              className="gradient-primary hidden md:flex"
              onClick={() => setIsAddOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              <span className="ml-2">Adicionar</span>
            </Button>
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
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBackupRole(role)}
                      className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground text-sm transition-colors hover:border-primary hover:text-primary"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Adicionar profissional backup
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddProfessionalModal
        patientId={patientId}
        availableTypes={availableTypes}
        isOpen={isAddOpen}
        setIsOpen={setIsAddOpen}
        onSuccess={() => fetchTeamMembers({ patientId })}
      />

      {backupRole && (
        <AddBackupProfessionalModal
          patientId={patientId}
          professionalType={backupRole}
          isOpen={backupRole !== null}
          setIsOpen={(open) => { if (!open) setBackupRole(null); }}
          onSuccess={() => fetchTeamMembers({ patientId })}
        />
      )}
    </>
  );
}
