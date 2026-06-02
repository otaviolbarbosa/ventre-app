"use client";

import { addPatientsToProfessionalAction } from "@/actions/add-patients-to-professional-action";
import { getPatientsNotInProfessionalTeamAction } from "@/actions/get-patients-not-in-professional-team-action";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { ProfessionalType } from "@/types";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { Flame, Loader2, Search, UserPlus, UserX2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Patient = {
  id: string;
  name: string;
  due_date: string | null;
  dum: string | null;
};

type AddPatientsModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  professionalId: string;
  professionalName: string;
  professionalType: ProfessionalType;
  onSuccess?: () => void;
  onAddPatient?: () => void;
};

export default function AddPatientsModal({
  showModal,
  setShowModal,
  professionalId,
  professionalName,
  professionalType,
  onSuccess,
  onAddPatient,
}: AddPatientsModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { executeAsync: fetchPatients, isPending: isLoading } = useAction(
    getPatientsNotInProfessionalTeamAction,
  );
  const { executeAsync: addPatients, isPending: isAdding } = useAction(
    addPatientsToProfessionalAction,
  );

  useEffect(() => {
    if (!showModal) return;
    setSelected(new Set());
    setSearch("");
    fetchPatients({ professionalId }).then((result) => {
      setPatients(result?.data?.patients ?? []);
    });
  }, [showModal, professionalId, fetchPatients]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    const result = await addPatients({
      professionalId,
      professionalType,
      patientIds: [...selected],
    });

    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }

    const count = result?.data?.successCount ?? 0;
    toast.success(
      count === 1
        ? `Gestante adicionada à equipe de ${professionalName}`
        : `${count} gestantes adicionadas à equipe de ${professionalName}`,
    );
    onSuccess?.();
    setShowModal(false);
  }

  const filtered = patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  return (
    <ContentModal
      open={showModal}
      onOpenChange={(open) => {
        if (!open) setShowModal(false);
      }}
      title="Adicionar gestantes"
      description={`Selecione as gestantes que serão acompanhadas por ${professionalName}.`}
    >
      <div className="flex flex-col gap-4 pt-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <UserX2 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              Não há gestantes para adicionar à equipe de ${professionalName}.
            </p>
            <Button variant="default" onClick={onAddPatient}>
              <UserPlus className="h-4 w-4" />
              Cadastrar gestante
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar gestante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex max-h-[380px] flex-col overflow-y-auto rounded-xl border">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-muted-foreground text-sm">
                  Nenhuma gestante encontrada.
                </p>
              ) : (
                <>
                  <label
                    htmlFor="select-all"
                    className="flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAll}
                      id="select-all"
                    />
                    <span className="font-medium text-sm">Selecionar todas</span>
                    {selected.size > 0 && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
                        {selected.size} selecionada{selected.size !== 1 ? "s" : ""}
                      </span>
                    )}
                  </label>
                  {filtered.map((patient) => (
                    <label
                      key={patient.id}
                      htmlFor={patient.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40 [&:not(:last-child)]:border-b"
                    >
                      <Checkbox
                        checked={selected.has(patient.id)}
                        onCheckedChange={() => toggle(patient.id)}
                        id={patient.id}
                      />
                      <PatientRow patient={patient} />
                    </label>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowModal(false)} disabled={isAdding}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            onClick={handleAdd}
            disabled={selected.size === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adicionando...
              </>
            ) : selected.size > 1 ? (
              `Adicionar ${selected.size} gestantes`
            ) : (
              "Adicionar"
            )}
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}

function PatientRow({ patient }: { patient: Patient }) {
  const ga = calculateGestationalAge(patient.dum);
  const dpp = patient.due_date ? dayjs(patient.due_date).format("DD/MM/YYYY") : null;
  const isOverdue = (ga?.weeks ?? 0) >= 40;
  const statusColor =
    (ga?.weeks ?? 0) >= 37 ? "#be5237" : (ga?.weeks ?? 0) >= 28 ? "#60a5fa" : "#4ade80";
  const circumference = 2 * Math.PI * 20;
  const progress = ga ? Math.min(ga.weeks / 40.5, 1) : 0;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
        <svg className="-rotate-90 absolute inset-0" viewBox="0 0 44 44" fill="none">
          <title>Progresso gestacional</title>
          <circle
            cx="22"
            cy="22"
            r="20"
            strokeWidth="3"
            stroke={statusColor}
            strokeOpacity="0.15"
          />
          {ga && (
            <circle
              cx="22"
              cy="22"
              r="20"
              strokeWidth="3"
              stroke={statusColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          )}
        </svg>
        <UserAvatar user={patient} size={9} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium text-sm">{patient.name}</p>
          {isOverdue && (
            <Flame className="size-3.5 shrink-0 text-destructive" fill="hsl(var(--destructive))" />
          )}
        </div>
        <div className="flex gap-2 text-muted-foreground text-xs">
          {dpp && <span>DPP: {dpp}</span>}
          {ga && dpp && <span>&bull;</span>}
          {ga && <span>{ga.label}</span>}
          {!dpp && !ga && <span>Sem dados gestacionais</span>}
        </div>
      </div>
    </div>
  );
}
