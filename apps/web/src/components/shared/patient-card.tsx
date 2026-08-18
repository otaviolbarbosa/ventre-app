import { PREGNANCY_DELIVERY_METHOD } from "@/lib/constants";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { cn } from "@/lib/utils";
import type { PatientWithGestationalInfo, TeamMember } from "@/types";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import type React from "react";
import TeamMembersAvatars from "./team-members-avatars";

export function PatientCard({
  patient,
  teamMembers,
  extra,
  noPadding = false,
}: {
  patient: PatientWithGestationalInfo;
  teamMembers?: TeamMember[];
  extra?: React.ReactNode | null;
  noPadding?: boolean;
}) {
  const dppFormatted = patient.due_date ? dayjs(patient.due_date).format("DD/MM") : null;
  const statusColor = patient.weeks >= 37 ? "#802f2d" : patient.weeks >= 28 ? "#cc8a00" : "#dfd1a7";

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 transition-colors hover:bg-muted/50",
        noPadding && "p-0",
      )}
    >
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
                  {patient.born_at && (
                    <div>Nascimento: {dayjs(patient.born_at).format("DD/MM/YYYY")}</div>
                  )}
                  {patient.delivery_method && (
                    <div>Via de parto: {PREGNANCY_DELIVERY_METHOD[patient.delivery_method]}</div>
                  )}
                  {patient.observations && <div>Obs: {patient.observations}</div>}
                  {extra}
                </div>
              ) : (
                <>
                  {dppFormatted ? <span>DPP: {dppFormatted}</span> : null}
                  {patient.dum && (
                    <>
                      &bull;
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {calculateGestationalAge(patient.dum)?.label}
                      </span>
                    </>
                  )}
                  {extra}
                </>
              )}
            </div>
          </div>
          {teamMembers?.length && (
            <div>
              <TeamMembersAvatars teamMembers={teamMembers} patientId={patient.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
