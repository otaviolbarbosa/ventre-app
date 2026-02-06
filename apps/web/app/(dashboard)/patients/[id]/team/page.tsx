"use client";

import { Plus, UserMinus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-state";
import TeamMemberCard from "@/components/shared/team-member-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import InviteProfessionalModal from "@/modals/invite-professional-modal";
import type { ProfessionalType, TeamMember } from "@/types";
import { supabase } from "@nascere/supabase";

export default function PatientTeamPage() {
  const params = useParams();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const patientId = params.id as string;

  useEffect(() => {
    async function fetchTeam() {
      const { data: team } = await supabase
        .from("team_members")
        .select(`
          *,
          professional:users!team_members_professional_id_fkey(id, name, email)
        `)
        .eq("patient_id", patientId);

      setTeamMembers(team || []);
      setLoading(false);
    }
    fetchTeam();
  }, [patientId]);

  // function handleCloseInviteModal() {
  //   setIsInviteOpen(false);
  //   setSelectedProfessional("");
  //   setSelectedType("");
  //   setSearchEmail("");
  //   setProfessionals([]);
  //   setInviteSent(false);
  //   setCopied(false);
  // }

  async function handleLeaveTeam() {
    if (!user?.id) return;
    setIsLeaving(true);

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("patient_id", patientId)
        .eq("professional_id", user.id);

      if (error) throw error;

      toast.success("Você saiu da equipe");
      window.location.href = "/patients";
    } catch {
      toast.error("Erro ao sair da equipe");
      setIsLeaving(false);
      setLeaveDialogOpen(false);
    }
  }

  const usedTypes = teamMembers.map((m) => m.professional_type);
  const availableTypes = (["obstetra", "enfermeiro", "doula"] as ProfessionalType[]).filter(
    (t) => !usedTypes.includes(t),
  );
  const isUserInTeam = teamMembers.some((m) => m.professional_id === user?.id);

  if (loading) {
    return <LoadingTable />;
  }

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
              <Button className="gradient-primary" onClick={() => setIsInviteOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="ml-2 hidden sm:block">Convidar Profissional</span>
              </Button>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
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
        patientId={patientId}
        isOpen={isInviteOpen}
        setIsOpen={setIsInviteOpen}
        availableTypes={availableTypes}
      />
    </>
  );
}
