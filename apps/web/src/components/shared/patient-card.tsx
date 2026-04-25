import { PREGNANCY_DELIVERY_METHOD } from "@/lib/constants";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { PatientWithGestationalInfo, TeamMember } from "@/types";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { Flame } from "lucide-react";
import TeamMembersAvatars from "./team-members-avatars";

export function PatientCard({
  patient,
  teamMembers,
}: {
  patient: PatientWithGestationalInfo;
  teamMembers?: TeamMember[];
}) {
  const mainTeamMembers = teamMembers?.filter((teamMember) => !teamMember.is_backup);

  const dppFormatted = dayjs(patient.due_date).format("DD/MM");
  const statusColor = patient.weeks >= 37 ? "#be5237" : patient.weeks >= 28 ? "#60a5fa" : "#4ade80";

  return (
    <div className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
        <svg className="-rotate-90 absolute inset-0" viewBox="0 0 56 56" fill="none">
          <title>Progress Bar</title>
          <circle cx="28" cy="28" r="26" strokeWidth="4" stroke={statusColor} strokeOpacity="0.1" />
          <circle
            cx="28"
            cy="28"
            r="26"
            strokeWidth="4"
            stroke={statusColor}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 26}
            strokeDashoffset={2 * Math.PI * 26 * (1 - patient.weeks / 40.5)}
          />
        </svg>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full font-semibold text-muted-foreground">
          <UserAvatar user={patient} size={12} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{patient.name}</h4>
            </div>
            <div className="flex gap-2 text-muted-foreground text-sm">
              {patient.has_finished ? (
                <div>
                  {patient.born_at && <div>Nascimento: {patient.born_at}</div>}
                  {patient.delivery_method && (
                    <div>Via de parto: {PREGNANCY_DELIVERY_METHOD[patient.delivery_method]}</div>
                  )}
                  {patient.observations && <div>Obs: {patient.observations}</div>}
                </div>
              ) : (
                <>
                  <span>DPP: {dppFormatted}</span>
                  &bull;
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {calculateGestationalAge(patient.dum)?.label}
                    {patient.weeks >= 40 && (
                      <Flame className="size-4 text-destructive" fill="hsl(var(--destructive))" />
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
          {mainTeamMembers && mainTeamMembers.length > 0 && (
            <div>
              <TeamMembersAvatars teamMembers={mainTeamMembers} patientId={patient.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
