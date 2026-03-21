import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { professionalTypeLabels } from "@/utils/team";
import { Clock } from "lucide-react";
import Avatar from "./avatar";

type PendingInviteCardProps = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  professionalType: string;
};

export default function PendingInviteCard({
  name,
  email,
  avatarUrl,
  professionalType,
}: PendingInviteCardProps) {
  return (
    <Card className="opacity-60">
      <CardContent className="space-y-3 p-4">
        <div className="flex w-full items-center gap-3 overflow-hidden">
          <div className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full bg-muted font-poppins font-semibold text-muted-foreground">
            <Avatar src={avatarUrl ?? ""} name={name} size={12} />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-1 justify-between gap-2 overflow-hidden truncate whitespace-nowrap">
              <p className="font-medium">{name}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="outline" className="gap-1 rounded-full text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Pendente
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {professionalTypeLabels[professionalType] ?? professionalType}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
