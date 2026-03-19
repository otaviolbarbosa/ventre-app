import { dayjs } from "@/lib/dayjs";
import type { PatientWithGestationalInfo, TeamMember } from "@/types";
import { getInitials } from "@/utils";
import { Flame } from "lucide-react";
import TeamMembersAvatars from "./team-members-avatars";

export function PatientCard({
  patient,
  teamMembers,
}: {
  patient: PatientWithGestationalInfo;
  teamMembers?: TeamMember[];
}) {
  const formattedGestationalAge = (weeks: number, days: number) => {
    let output = "";
    output += `${weeks} semana${weeks === 1 ? "" : "s"}`;

    if (days > 0) {
      output += ` e ${days} dia${days === 1 ? "" : "s"}`;
    }

    return output;
  };

  const dppFormatted = dayjs(patient.due_date).format("DD/MM");
  const statusColor =
    patient.weeks >= 37 ? "bg-orange-400" : patient.weeks >= 28 ? "bg-blue-400" : "bg-green-400";

  return (
    <div className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground shadow">
        {getInitials(patient.name)}
        <div className={`absolute right-1 bottom-1 h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{patient.name}</h4>
            </div>
            <div className="flex gap-2 text-muted-foreground text-sm">
              <span>DPP: {dppFormatted}</span>
              &bull;
              <span className="flex items-center gap-2 text-muted-foreground">
                {formattedGestationalAge(patient.weeks, patient.days)}
                {patient.weeks >= 40 && (
                  <Flame className="size-4 text-destructive" fill="hsl(var(--destructive))" />
                )}
              </span>
            </div>
          </div>
          {teamMembers && teamMembers.length > 0 && (
            <div>
              <TeamMembersAvatars teamMembers={teamMembers} patientId={patient.id} />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1 overflow-hidden rounded-full border border-[#DEC9C8] bg-[url('/images/bg-pattern-2.svg')] bg-muted bg-repeat p-[1px] shadow">
            <div
              className="inset-y-0 left-0 h-2 rounded-full bg-primary"
              style={{ width: `${patient.progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
