import { Header } from "@/components/layouts/header";
import ContractList from "@/components/patient-area/contract-list";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { Contract, ContractChangeRequestWithContract } from "@/services/patient-self";
import type { Tables } from "@ventre/supabase";
import Link from "next/link";

type PatientHomeScreenProps = {
  name: string | null | undefined;
  pregnancy: Tables<"pregnancies"> | null;
  contracts: Contract[];
  changeRequests: ContractChangeRequestWithContract[];
  error: string | null | undefined;
};

export default function PatientHomeScreen({
  name,
  pregnancy,
  contracts,
  changeRequests,
  error,
}: PatientHomeScreenProps) {
  const gestationalWeek = calculateGestationalAge(pregnancy?.dum);

  return (
    <div>
      <Header title={name ? `Olá ${name}!` : "Olá Gestante!"} />

      <div className="space-y-6 px-4">
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
                  {gestationalWeek?.fullLabel ?? "—"}
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

        {(contracts.length > 0 || changeRequests.length > 0) && (
          <div>
            <p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Contratos</p>
            <ContractList contracts={contracts} changeRequests={changeRequests} />
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
    </div>
  );
}
