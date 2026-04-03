import type { EnterpriseStaffMember } from "@/services/enterprise-users";
import { getInitials } from "@/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Badge } from "@ventre/ui/badge";
import { Card, CardContent } from "@ventre/ui/card";

const STAFF_TYPE_LABELS: Record<string, string> = {
  manager: "Gestora",
  secretary: "Secretária",
};

type StaffCardProps = {
  member: EnterpriseStaffMember;
};

export function StaffCard({ member }: StaffCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage
              src={member.avatar_url || undefined}
              alt={member.name || ""}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {getInitials(member.name ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{member.name ?? "—"}</p>
            <p className="truncate text-muted-foreground text-xs">{member.email ?? "—"}</p>
            <Badge variant="outline" className="mt-1 text-xs">
              {STAFF_TYPE_LABELS[member.user_type] ?? member.user_type}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
