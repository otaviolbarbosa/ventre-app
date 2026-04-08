"use client";

import { removeBackupProfessionalAction } from "@/actions/remove-backup-professional-action";
import type { TeamMember } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { Trash } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { useAuth } from "../../providers/auth-provider";

type TeamMemberCardProps = {
  member: TeamMember;
  isOwner: boolean;
  onRemoved?: () => void;
};

export default function TeamMemberCard({ member, isOwner, onRemoved }: TeamMemberCardProps) {
  const { profile, isStaff } = useAuth();
  const isBackup = member.is_backup === true;
  const isExternal = !member.professional;
  const isSameProfessionalType = profile?.professional_type === member.professional_type;

  const { confirm } = useConfirmModal();

  const { executeAsync: executeRemove } = useAction(removeBackupProfessionalAction, {
    onSuccess: () => {
      toast.success("Backup removido com sucesso");
      onRemoved?.();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao remover backup");
    },
  });

  const canRemove = isStaff || (isBackup && isSameProfessionalType);

  function handleConfirmRemove() {
    confirm({
      title: isBackup ? "Remover profissional backup" : "Remover da equipe",
      description: `Tem certeza que deseja remover ${member.professional?.name ?? "este profissional"} da equipe${isBackup ? " de backup" : ""}?`,
      confirmLabel: "Remover",
      variant: "destructive",
      onConfirm: async () => {
        await executeRemove({ teamMemberId: member.id });
      },
    });
  }

  return (
    <Card className={isBackup ? "opacity-60" : ""}>
      <CardContent className="space-y-3 p-4">
        <div className="flex w-full items-center gap-3">
          <div className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full bg-muted font-poppins font-semibold text-muted-foreground">
            <UserAvatar
              user={isExternal ? { name: "? ?" } : (member.professional ?? { name: "? ?" })}
              size={12}
            />
            {isOwner && (
              <span className="-right-0.5 absolute bottom-0 block size-3 rounded-full border-2 border-white bg-green-500" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-1 justify-between gap-2 truncate whitespace-nowrap">
              <p className="font-medium">
                {isExternal ? "Equipe Externa" : member.professional?.name}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="outline" className="rounded-full">
                  {professionalTypeLabels[member.professional_type]}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{member.professional?.email}</p>
              {canRemove && (
                <Button variant="ghost" size="icon-sm" onClick={handleConfirmRemove}>
                  <Trash stroke="hsl(var(--destructive))" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
