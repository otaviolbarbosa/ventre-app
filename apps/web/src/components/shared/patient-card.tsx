import { dayjs } from "@/lib/dayjs";
import type { PatientWithGestationalInfo } from "@/types";
import { getInitials } from "@/utils";

export function PatientCard({ patient }: { patient: PatientWithGestationalInfo }) {
  const formattedGestationalAge = (weeks: number, days: number) => {
    let output = "";
    output += `${weeks} semana${weeks === 1 ? "" : "s"}`;

    if (days > 0) {
      output += ` e ${days} dia${days === 1 ? "" : "s"}`;
    }

    return output;
  };
  //  {patient.weeks} semanas {patient.days ? ` e ${patient.days} dias` : ""}
  const dppFormatted = dayjs(patient.due_date).format("DD [de] MMMM");
  const statusColor =
    patient.weeks >= 37 ? "bg-orange-400" : patient.weeks >= 28 ? "bg-blue-400" : "bg-green-400";

  return (
    <div className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground shadow">
        {getInitials(patient.name)}
        <div className={`absolute right-1 bottom-1 h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{patient.name}</h4>
        </div>
        <p className="text-muted-foreground text-sm">
          DPP: {dppFormatted} &bull;{" "}
          <span className="text-muted-foreground">
            {formattedGestationalAge(patient.weeks, patient.days)}
          </span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1 overflow-hidden rounded-full bg-[url('/images/bg-pattern-2.svg')] bg-muted bg-repeat p-0.5 shadow">
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
