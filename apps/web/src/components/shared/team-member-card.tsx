"use client";

import { removeBackupProfessionalAction } from "@/actions/remove-backup-professional-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamMember } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { Trash } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../providers/auth-provider";
import { Button } from "../ui/button";
import Avatar from "./avatar";
import { ConfirmModal } from "./confirm-modal";

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

  const [confirmOpen, setConfirmOpen] = useState(false);

  const { execute: executeRemove, status: removeStatus } = useAction(
    removeBackupProfessionalAction,
    {
      onSuccess: () => {
        toast.success("Backup removido com sucesso");
        setConfirmOpen(false);
        onRemoved?.();
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Erro ao remover backup");
        setConfirmOpen(false);
      },
    },
  );

  const canRemove = isStaff || (isBackup && isSameProfessionalType);

  return (
    <>
      <Card className={isBackup ? "opacity-60" : ""}>
        <CardContent className="space-y-3 p-4">
          <div className="flex w-full items-center gap-3 overflow-hidden">
            <div className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full bg-muted font-poppins font-semibold text-muted-foreground">
              <Avatar
                src={member.professional?.avatar_url ?? ""}
                name={isExternal ? "? ?" : (member.professional?.name ?? "")}
                size={12}
              />
              {isOwner && (
                <span className="-right-0.5 absolute bottom-0 block size-3 rounded-full border-2 border-white bg-green-500" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-1 justify-between gap-2 overflow-hidden truncate whitespace-nowrap">
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
                  <Button variant="ghost" size="icon-sm" onClick={() => setConfirmOpen(true)}>
                    <Trash stroke="hsl(var(--destructive))" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isBackup ? "Remover profissional backup" : "Remover da equipe"}
        description={`Tem certeza que deseja remover ${member.professional?.name ?? "este profissional"} da equipe${isBackup ? " de backup" : ""}?`}
        confirmLabel="Remover"
        variant="destructive"
        loading={removeStatus === "executing"}
        onConfirm={() => executeRemove({ teamMemberId: member.id })}
      />
    </>
  );
}
