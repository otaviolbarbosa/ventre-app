import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamMember } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import Avatar from "./avatar";

type TeamMemberCardProps = {
  member: TeamMember;
  isOwner: boolean;
};

export default function TeamMemberCard({ member, isOwner }: TeamMemberCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex w-full items-center gap-3 overflow-hidden">
          <div className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full bg-muted font-poppins font-semibold text-muted-foreground">
            <Avatar
              src={member.professional?.avatar_url ?? ""}
              name={member.professional?.name ?? ""}
              size={12}
            />
            {isOwner && (
              <span className="-right-0.5 absolute bottom-0 block size-3 rounded-full border-2 border-white bg-green-500" />
            )}
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 justify-between gap-2 overflow-hidden truncate whitespace-nowrap">
              <p className="font-medium">{member.professional?.name}</p>
              <Badge variant="outline" className="rounded-full">
                {professionalTypeLabels[member.professional_type]}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{member.professional?.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
