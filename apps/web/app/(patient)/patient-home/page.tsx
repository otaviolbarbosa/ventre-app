import { getServerAuth } from "@/lib/server-auth";
import { getMyPregnancy } from "@/services/patient-self";
import { dayjs } from "@/lib/dayjs";
import Link from "next/link";

export default async function PatientHomePage() {
  const { profile } = await getServerAuth();
  const { patient, pregnancy, error } = await getMyPregnancy();

  const gestationalWeek = pregnancy?.dum
    ? Math.floor(dayjs().diff(dayjs(pregnancy.dum), "day") / 7)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">Olá,</p>
        <h1 className="font-bold text-2xl text-[#433831]">{profile?.name ?? patient?.name}</h1>
      </div>

      {error && (
        <div className="rounded-2xl bg-white p-6 text-center text-muted-foreground text-sm shadow-sm">
          {error}
        </div>
      )}

      {pregnancy && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Acompanhamento pré-natal
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Semanas de gestação</p>
              <p className="font-semibold text-[#433831] text-lg">
                {gestationalWeek !== null ? `${gestationalWeek} semanas` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Data prevista do parto</p>
              <p className="font-semibold text-[#433831] text-lg">
                {dayjs(pregnancy.due_date).format("DD/MM/YYYY")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/cartao-pre-natal"
          className="rounded-xl border bg-white p-4 text-center shadow-sm transition-colors hover:border-primary"
        >
          <p className="font-medium text-sm">Cartão pré-natal</p>
        </Link>
        <Link
          href="/agenda"
          className="rounded-xl border bg-white p-4 text-center shadow-sm transition-colors hover:border-primary"
        >
          <p className="font-medium text-sm">Agenda</p>
        </Link>
        <Link
          href="/financeiro"
          className="rounded-xl border bg-white p-4 text-center shadow-sm transition-colors hover:border-primary"
        >
          <p className="font-medium text-sm">Financeiro</p>
        </Link>
      </div>
    </div>
  );
}
