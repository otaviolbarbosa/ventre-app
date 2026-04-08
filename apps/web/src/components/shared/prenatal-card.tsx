"use client";

import { deleteLabExamAction } from "@/actions/delete-lab-exam-action";
import { getPrenatalCardAction } from "@/actions/get-prenatal-card-action";
import { EmptyState } from "@/components/shared/empty-state";
import { dayjs } from "@/lib/dayjs";
import {
  AMNIOTIC_FLUID_INDEX_LABELS,
  CLINICAL_FIELDS,
  DOPPLER_RESULT_LABELS,
  FETAL_PRESENTATION_LABELS,
  HEMOGLOBIN_LABELS,
  RISK_GROUPS,
  SURGICAL_FIELDS,
  VACCINE_LABELS,
  VACCINE_NAMES,
  VACCINE_STATUS_LABELS,
} from "@/lib/prenatal-constants";
import { AddLabExamModal } from "@/modals/add-lab-exam-modal";
import { AddOtherExamModal } from "@/modals/add-other-exam-modal";
import { AddPregnancyEvolutionModal } from "@/modals/add-pregnancy-evolution-modal";
import { AddUltrasoundModal } from "@/modals/add-ultrasound-modal";
import { EditGeneralDataModal } from "@/modals/edit-general-data-modal";
import { EditObstetricHistoryModal } from "@/modals/edit-obstetric-history-modal";
import { EditRiskFactorsModal } from "@/modals/edit-risk-factors-modal";
import { EditVaccineRecordModal } from "@/modals/edit-vaccine-record-modal";
import type { Tables } from "@ventre/supabase";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { Separator } from "@ventre/ui/separator";
import { Skeleton } from "@ventre/ui/skeleton";
import {
  Activity,
  Baby,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  HelpCircle,
  Pencil,
  Plus,
  ShieldAlert,
  Stethoscope,
  Syringe,
  TestTube2,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type PrenatalData = {
  patient: Pick<
    Tables<"patients">,
    | "blood_type"
    | "height_cm"
    | "allergies"
    | "personal_notes"
    | "family_history_diabetes"
    | "family_history_hypertension"
    | "family_history_twin"
    | "family_history_others"
  > | null;
  pregnancy: Pick<
    Tables<"pregnancies">,
    | "gestations_count"
    | "deliveries_count"
    | "cesareans_count"
    | "abortions_count"
    | "initial_weight_kg"
    | "initial_bmi"
    | "baby_name"
    | "reference_hospital"
  > | null;
  obstetricHistory: Tables<"patient_obstetric_history"> | null;
  riskFactors: Tables<"pregnancy_risk_factors"> | null;
  evolutions: Tables<"pregnancy_evolutions">[];
  ultrasounds: Tables<"ultrasounds">[];
  labExams: Tables<"lab_exam_results">[];
  vaccines: Tables<"vaccine_records">[];
  otherExams: Tables<"other_exams">[];
};

// ── Helper ───────────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function BooleanBadge({ value, label }: { value: boolean | null | undefined; label: string }) {
  if (!value) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      {label}
    </Badge>
  );
}

// ── Section: Dados Gerais ────────────────────────────────────────────────────

function GeneralDataSection({
  patientId,
  pregnancyId,
  data,
  onRefresh,
}: {
  patientId: string;
  pregnancyId: string;
  data: PrenatalData;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const patient = data.patient;
  const pregnancy = data.pregnancy;

  const hasFamilyHistory =
    patient?.family_history_diabetes ||
    patient?.family_history_hypertension ||
    patient?.family_history_twin ||
    patient?.family_history_others;

  return (
    <div>
      <SectionHeader
        icon={User}
        title="Dados Gerais"
        action={
          <>
            <Button
              size="icon"
              variant="outline"
              className="sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Pencil className="h-3 w-3" />
              Editar
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-lg border">
        {/* Métricas principais */}
        <div className="grid grid-cols-2 divide-x sm:grid-cols-4">
          <div className="px-3 py-2.5 text-center">
            <p className="mb-0.5 text-muted-foreground text-xs">Tipo sanguíneo</p>
            <p className="font-medium text-sm">{patient?.blood_type ?? "-"}</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="mb-0.5 text-muted-foreground text-xs">Altura</p>
            <p className="font-medium text-sm">
              {patient?.height_cm ? `${patient.height_cm} cm` : "-"}
            </p>
          </div>
          <div className="border-t px-3 py-2.5 text-center sm:border-t-0">
            <p className="mb-0.5 text-muted-foreground text-xs">Peso inicial</p>
            <p className="font-medium text-sm">
              {pregnancy?.initial_weight_kg ? `${pregnancy.initial_weight_kg} kg` : "-"}
            </p>
          </div>
          <div className="border-t px-3 py-2.5 text-center sm:border-t-0">
            <p className="mb-0.5 text-muted-foreground text-xs">IMC inicial</p>
            <p className="font-medium text-sm">{pregnancy?.initial_bmi?.toString() ?? "-"}</p>
          </div>
        </div>

        {/* Nome do bebê / Hospital de referência */}
        {(pregnancy?.baby_name || pregnancy?.reference_hospital) && (
          <div className="border-t">
            <div
              className={`grid divide-x ${pregnancy?.baby_name && pregnancy?.reference_hospital ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {pregnancy?.baby_name && (
                <div className="px-4 py-2.5">
                  <p className="mb-0.5 font-medium text-muted-foreground text-xs">Nome do bebê</p>
                  <p className="font-medium text-sm">{pregnancy.baby_name}</p>
                </div>
              )}
              {pregnancy?.reference_hospital && (
                <div className="px-4 py-2.5">
                  <p className="mb-0.5 font-medium text-muted-foreground text-xs">
                    Hospital de referência
                  </p>
                  <p className="font-medium text-sm">{pregnancy.reference_hospital}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alergias */}
        {patient?.allergies && patient.allergies.length > 0 && (
          <div className="border-t px-4 py-2.5">
            <p className="mb-1 font-medium text-muted-foreground text-xs">Alergias</p>
            <div className="flex flex-wrap gap-1.5">
              {patient.allergies.map((a) => (
                <Badge key={a} variant="secondary" className="text-xs">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Histórico familiar */}
        {hasFamilyHistory && (
          <div className="border-t bg-muted/20 px-4 py-2.5">
            <p className="mb-1.5 font-medium text-muted-foreground text-xs">Histórico familiar</p>
            <div className="flex flex-wrap gap-1.5">
              <BooleanBadge value={patient?.family_history_diabetes} label="Diabetes" />
              <BooleanBadge value={patient?.family_history_hypertension} label="Hipertensão" />
              <BooleanBadge value={patient?.family_history_twin} label="Gemelar" />
              {patient?.family_history_others && (
                <Badge variant="secondary" className="text-xs">
                  {patient.family_history_others}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Observações pessoais */}
        {patient?.personal_notes && (
          <div className="border-t px-4 py-2.5">
            <p className="mb-0.5 font-medium text-muted-foreground text-xs">Observações pessoais</p>
            <p className="text-sm">{patient.personal_notes}</p>
          </div>
        )}
      </div>

      <EditGeneralDataModal
        open={showModal}
        onOpenChange={setShowModal}
        patientId={patientId}
        pregnancyId={pregnancyId}
        patientData={data.patient}
        pregnancyData={data.pregnancy}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Section: Antecedentes Obstétricos ────────────────────────────────────────

function ObstetricHistorySection({
  patientId,
  pregnancyId,
  history,
  pregnancy,
  onRefresh,
}: {
  patientId: string;
  pregnancyId: string;
  history: Tables<"patient_obstetric_history"> | null;
  pregnancy: PrenatalData["pregnancy"];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const activeClinical = CLINICAL_FIELDS.filter((f) => history?.[f.name as keyof typeof history]);
  const activeSurgical = SURGICAL_FIELDS.filter((f) => history?.[f.name as keyof typeof history]);
  const hasPregnancyCounts =
    pregnancy?.gestations_count != null ||
    pregnancy?.deliveries_count != null ||
    pregnancy?.cesareans_count != null ||
    pregnancy?.abortions_count != null;
  const hasData = activeClinical.length > 0 || activeSurgical.length > 0 || hasPregnancyCounts;

  return (
    <div>
      <SectionHeader
        icon={ClipboardList}
        title="Antecedentes Obstétricos"
        action={
          <>
            <Button
              size="icon"
              variant="outline"
              className="sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Pencil className="h-3 w-3" />
              Editar
            </Button>
          </>
        }
      />

      {!hasData ? (
        <p className="text-muted-foreground text-sm italic">Nenhum antecedente registrado.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {/* Contagens obstétricas */}
          {hasPregnancyCounts && (
            <div className="grid grid-cols-2 divide-x sm:grid-cols-4">
              <div className="px-3 py-2.5 text-center">
                <p className="mb-0.5 text-muted-foreground text-xs">Gestações</p>
                <p className="font-medium text-sm">{pregnancy?.gestations_count ?? "-"}</p>
              </div>
              <div className="px-3 py-2.5 text-center">
                <p className="mb-0.5 text-muted-foreground text-xs">Partos</p>
                <p className="font-medium text-sm">{pregnancy?.deliveries_count ?? "-"}</p>
              </div>
              <div className="border-t px-3 py-2.5 text-center sm:border-t-0">
                <p className="mb-0.5 text-muted-foreground text-xs">Cesáreas</p>
                <p className="font-medium text-sm">{pregnancy?.cesareans_count ?? "-"}</p>
              </div>
              <div className="border-t px-3 py-2.5 text-center sm:border-t-0">
                <p className="mb-0.5 text-muted-foreground text-xs">Abortos</p>
                <p className="font-medium text-sm">{pregnancy?.abortions_count ?? "-"}</p>
              </div>
            </div>
          )}

          {/* Antecedentes clínicos */}
          {activeClinical.length > 0 && (
            <div className="border-t px-4 py-2.5">
              <p className="mb-1.5 font-medium text-muted-foreground text-xs">Clínicos</p>
              <div className="flex flex-wrap gap-1.5">
                {activeClinical.map((f) => (
                  <Badge key={f.name} variant="secondary" className="text-xs">
                    {f.label}
                  </Badge>
                ))}
              </div>
              {history?.other_clinical_notes && (
                <p className="mt-1.5 text-sm">{history.other_clinical_notes}</p>
              )}
            </div>
          )}

          {/* Antecedentes cirúrgicos */}
          {activeSurgical.length > 0 && (
            <div className="border-t bg-muted/20 px-4 py-2.5">
              <p className="mb-1.5 font-medium text-muted-foreground text-xs">Cirúrgicos</p>
              <div className="flex flex-wrap gap-1.5">
                {activeSurgical.map((f) => (
                  <Badge key={f.name} variant="secondary" className="text-xs">
                    {f.label}
                  </Badge>
                ))}
              </div>
              {history?.other_surgery_notes && (
                <p className="mt-1.5 text-sm">{history.other_surgery_notes}</p>
              )}
            </div>
          )}
        </div>
      )}

      <EditObstetricHistoryModal
        open={showModal}
        onOpenChange={setShowModal}
        patientId={patientId}
        pregnancyId={pregnancyId}
        history={history}
        pregnancyCounts={pregnancy}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Section: Fatores de Risco ─────────────────────────────────────────────────

function RiskFactorsSection({
  pregnancyId,
  riskFactors,
  onRefresh,
}: {
  pregnancyId: string;
  riskFactors: Tables<"pregnancy_risk_factors"> | null;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const activeRisks = RISK_GROUPS.flatMap((g) =>
    g.fields.filter((f) => riskFactors?.[f.name as keyof typeof riskFactors]),
  );

  return (
    <div>
      <SectionHeader
        icon={ShieldAlert}
        title="Fatores de Risco da Gestação"
        action={
          <>
            <Button
              size="icon"
              variant="outline"
              className="sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Pencil className="h-3 w-3" />
              Editar
            </Button>
          </>
        }
      />

      {activeRisks.length === 0 && !riskFactors?.other_notes ? (
        <p className="text-muted-foreground text-sm italic">Nenhum fator de risco registrado.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {RISK_GROUPS.map((group, idx) => {
            const active = group.fields.filter(
              (f) => riskFactors?.[f.name as keyof typeof riskFactors],
            );
            if (active.length === 0) return null;
            return (
              <div key={group.label} className={idx > 0 ? "border-t px-4 py-2.5" : "px-4 py-2.5"}>
                <p className="mb-1.5 font-medium text-muted-foreground text-xs">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {active.map((f) => (
                    <Badge key={f.name} variant="destructive" className="font-normal text-xs">
                      {f.label}
                    </Badge>
                  ))}
                </div>
                {riskFactors?.smoking &&
                  riskFactors?.cigarettes_per_day &&
                  group.label === "Estilo de vida" && (
                    <p className="mt-1.5 text-muted-foreground text-sm">
                      Cigarros/dia:{" "}
                      <span className="font-medium text-foreground">
                        {riskFactors.cigarettes_per_day}
                      </span>
                    </p>
                  )}
              </div>
            );
          })}
          {riskFactors?.other_notes && (
            <div className="border-t bg-muted/20 px-4 py-2.5">
              <p className="mb-0.5 font-medium text-muted-foreground text-xs">Observações</p>
              <p className="text-sm">{riskFactors.other_notes}</p>
            </div>
          )}
        </div>
      )}

      <EditRiskFactorsModal
        open={showModal}
        onOpenChange={setShowModal}
        pregnancyId={pregnancyId}
        riskFactors={riskFactors}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Section: Evoluções da Gestação ───────────────────────────────────────────

function EvolutionsSection({
  pregnancyId,
  evolutions,
  onRefresh,
}: {
  pregnancyId: string;
  evolutions: Tables<"pregnancy_evolutions">[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <SectionHeader
        icon={Activity}
        title="Evoluções da Gestação"
        action={
          <>
            <Button
              size="icon"
              className="gradient-primary sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </>
        }
      />

      {evolutions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma evolução registrada"
          description="Registre as consultas pré-natais da gestante."
        >
          <Button size="sm" className="gradient-primary" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Adicionar evolução
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {evolutions.map((ev) => (
            <div key={ev.id} className="overflow-hidden rounded-lg border">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                <span className="font-semibold text-sm">
                  {dayjs(ev.consultation_date).format("DD/MM/YYYY")}
                </span>
                <div className="flex items-center gap-2">
                  {ev.gestational_weeks != null ? (
                    <Badge variant="outline" className="text-xs">
                      {ev.gestational_weeks}s
                      {ev.gestational_days != null ? `${ev.gestational_days}d` : ""}
                      {" · "}
                      {ev.ig_source === "usg" ? "USG" : "DUM"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      IG não informada
                    </Badge>
                  )}
                </div>
              </div>

              {/* Grid de métricas */}
              <div className="grid grid-cols-4 divide-x text-center">
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Peso</p>
                  <p className="font-medium text-sm">
                    {ev.weight_kg != null ? `${ev.weight_kg} kg` : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">PA (mmHg)</p>
                  <p className="font-medium text-sm">
                    {ev.systolic_bp != null || ev.diastolic_bp != null
                      ? `${ev.systolic_bp ?? "-"}/${ev.diastolic_bp ?? "-"}`
                      : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">AU (cm)</p>
                  <p className="font-medium text-sm">
                    {ev.uterine_height_cm != null ? ev.uterine_height_cm : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">BCF (bpm)</p>
                  <p className="font-medium text-sm">
                    {ev.fetal_heart_rate != null ? ev.fetal_heart_rate : "-"}
                  </p>
                </div>
              </div>

              {/* Segunda linha de métricas */}
              <div className="grid grid-cols-4 divide-x border-t text-center">
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Apresentação</p>
                  <p className="font-medium text-sm">
                    {ev.fetal_presentation ? FETAL_PRESENTATION_LABELS[ev.fetal_presentation] : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Edema</p>
                  <p className="font-medium text-sm">
                    {ev.edema != null ? (ev.edema ? "Sim" : "Não") : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">MF</p>
                  <p className="font-medium text-sm">
                    {ev.fetal_movement != null ? (ev.fetal_movement ? "Presente" : "Ausente") : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Exame de colo</p>
                  <p className="truncate font-medium text-sm">{ev.cervical_exam ?? "-"}</p>
                </div>
              </div>

              {/* Notas textuais */}
              {(ev.complaint || ev.observations || ev.responsible) && (
                <div className="grid grid-cols-4 divide-x border-t bg-muted/20">
                  <div className="px-3 py-2.5">
                    <p className="mb-0.5 font-medium text-muted-foreground text-xs">Queixa</p>
                    <p className="text-xs">{ev.complaint || "-"}</p>
                  </div>
                  <div className="col-span-2 px-3 py-2.5">
                    <p className="mb-0.5 font-medium text-muted-foreground text-xs">Conduta</p>
                    <p className="whitespace-pre-wrap text-xs">{ev.observations || "-"}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="mb-0.5 font-medium text-muted-foreground text-xs">Responsável</p>
                    <p className="text-xs">{ev.responsible || "-"}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddPregnancyEvolutionModal
        open={showModal}
        onOpenChange={setShowModal}
        pregnancyId={pregnancyId}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Section: Ultrassonografias ───────────────────────────────────────────────

function UltrasoundsSection({
  pregnancyId,
  ultrasounds,
  onRefresh,
}: {
  pregnancyId: string;
  ultrasounds: Tables<"ultrasounds">[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <SectionHeader
        icon={Baby}
        title="Ultrassonografias"
        action={
          <>
            <Button
              size="icon"
              className="gradient-primary sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </>
        }
      />

      {ultrasounds.length === 0 ? (
        <EmptyState
          icon={Baby}
          title="Nenhuma ultrassonografia registrada"
          description="Registre os exames de imagem da gestante."
        >
          <Button size="sm" className="gradient-primary" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Adicionar USG
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {ultrasounds.map((usg) => (
            <div key={usg.id} className="overflow-hidden rounded-lg border">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                <span className="font-semibold text-sm">
                  {dayjs(usg.exam_date).format("DD/MM/YYYY")}
                </span>
                {usg.gestational_weeks != null ? (
                  <Badge variant="outline" className="text-xs">
                    {usg.gestational_weeks}s
                    {usg.gestational_days != null ? `${usg.gestational_days}d` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    IG não informada
                  </Badge>
                )}
              </div>

              {/* Linha 1: FCF · CCN · TN · Colo */}
              <div className="grid grid-cols-4 divide-x text-center">
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">FCF (bpm)</p>
                  <p className="font-medium text-sm">{usg.fetal_heart_rate_bpm ?? "-"}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">CCN (mm)</p>
                  <p className="font-medium text-sm">{usg.ccn_mm ?? "-"}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">TN (mm)</p>
                  <p className="font-medium text-sm">{usg.nuchal_translucency_mm ?? "-"}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Colo (cm)</p>
                  <p className="font-medium text-sm">{usg.cervical_length_cm ?? "-"}</p>
                </div>
              </div>

              {/* Linha 2: Peso est. · ILA · Placenta · Doppler */}
              <div className="grid grid-cols-4 divide-x border-t text-center">
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Peso est. (g)</p>
                  <p className="font-medium text-sm">{usg.estimated_weight_g ?? "-"}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">ILA</p>
                  <p className="font-medium text-sm">
                    {usg.amniotic_fluid_index
                      ? AMNIOTIC_FLUID_INDEX_LABELS[usg.amniotic_fluid_index]
                      : "-"}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Placenta</p>
                  <p className="truncate font-medium text-sm">{usg.placenta_position ?? "-"}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="mb-0.5 text-muted-foreground text-xs">Doppler</p>
                  <p className="font-medium text-sm">
                    {usg.doppler_result ? DOPPLER_RESULT_LABELS[usg.doppler_result] : "-"}
                  </p>
                </div>
              </div>

              {/* Linha 3: flags booleanas */}
              <div className="flex items-center gap-3 border-t bg-muted/20 px-4 py-2">
                <span className="text-muted-foreground text-xs">Osso nasal:</span>
                <span className="font-medium text-xs">
                  {usg.nasal_bone_present == null
                    ? "-"
                    : usg.nasal_bone_present
                      ? "Presente"
                      : "Ausente"}
                </span>
                <span className="mx-1 text-muted-foreground/40">·</span>
                <span className="text-muted-foreground text-xs">CIUR:</span>
                {usg.iugr == null ? (
                  <span className="font-medium text-xs">-</span>
                ) : usg.iugr ? (
                  <Badge variant="destructive" className="text-xs">
                    Sim
                  </Badge>
                ) : (
                  <span className="font-medium text-xs">Não</span>
                )}
              </div>

              {/* Notas */}
              {usg.notes && (
                <div className="border-t px-4 py-2.5">
                  <p className="text-xs">
                    <span className="font-medium text-muted-foreground">Obs:</span> {usg.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddUltrasoundModal
        open={showModal}
        onOpenChange={setShowModal}
        pregnancyId={pregnancyId}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Section: Exames Laboratoriais ─────────────────────────────────────────────

function LabExamsSection({
  pregnancyId,
  labExams,
  onRefresh,
}: {
  pregnancyId: string;
  labExams: Tables<"lab_exam_results">[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Tables<"lab_exam_results"> | null>(null);
  const { confirm } = useConfirmModal();
  const { executeAsync: deleteExam } = useAction(deleteLabExamAction);

  function handleConfirmDelete(examId: string) {
    confirm({
      title: "Remover exame",
      description: "Tem certeza que deseja remover este exame? Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      variant: "destructive",
      onConfirm: async () => {
        const result = await deleteExam({ examId });
        if (result?.serverError) {
          toast.error(result.serverError);
          return;
        }
        toast.success("Exame removido!");
        onRefresh();
      },
    });
  }

  return (
    <div>
      <SectionHeader
        icon={FlaskConical}
        title="Exames Laboratoriais"
        action={
          <>
            <Button
              size="icon"
              className="gradient-primary sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </>
        }
      />

      {labExams.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum exame registrado"
          description="Registre os exames laboratoriais da gestante."
        >
          <Button size="sm" className="gradient-primary" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Adicionar exame
          </Button>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="pr-4 pb-2 font-medium">Exame</th>
                <th className="pr-4 pb-2 font-medium">Data</th>
                <th className="pr-4 pb-2 font-medium">Resultado</th>
                <th className="pr-4 pb-2 font-medium">Unidade</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {labExams.map((exam) => (
                <tr key={exam.id} className="group border-b last:border-0">
                  <td className="truncate py-2 pr-4 font-medium">{exam.exam_name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {dayjs(exam.exam_date).format("DD/MM/YYYY")}
                  </td>
                  <td className="py-2 pr-4">
                    {exam.result_text ||
                      exam.result_numeric?.toString() ||
                      (exam.hemoglobin_electrophoresis
                        ? HEMOGLOBIN_LABELS[exam.hemoglobin_electrophoresis]
                        : "-")}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{exam.unit || "-"}</td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingExam(exam)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleConfirmDelete(exam.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddLabExamModal
        open={showModal || !!editingExam}
        onOpenChange={(open) => {
          if (!open) {
            setShowModal(false);
            setEditingExam(null);
          }
        }}
        pregnancyId={pregnancyId}
        exam={editingExam ?? undefined}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Section: Vacinas ─────────────────────────────────────────────────────────

function VaccinesSection({
  pregnancyId,
  vaccines,
  onRefresh,
}: {
  pregnancyId: string;
  vaccines: Tables<"vaccine_records">[];
  onRefresh: () => void;
}) {
  const [editingVaccineName, setEditingVaccineName] = useState<string | null>(null);

  const editingRecord = editingVaccineName
    ? vaccines.find((v) => v.vaccine_name === editingVaccineName)
    : undefined;

  return (
    <div>
      <SectionHeader icon={Syringe} title="Vacinas" />

      <div className="grid gap-2 sm:grid-cols-2">
        {VACCINE_NAMES.map((vName) => {
          const record = vaccines.find((v) => v.vaccine_name === vName);
          return (
            <button
              key={vName}
              type="button"
              onClick={() => setEditingVaccineName(vName)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              {!record || !record.status ? (
                <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              ) : record.status === "applied" || record.status === "immunized" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{VACCINE_LABELS[vName]}</p>
                {record ? (
                  <p className="text-muted-foreground text-xs">
                    {record.status ? VACCINE_STATUS_LABELS[record.status] : ""}
                    {record.applied_date
                      ? ` · ${dayjs(record.applied_date).format("DD/MM/YYYY")}`
                      : ""}
                    {record.dose_number ? ` · Dose ${record.dose_number}` : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">Não registrada</p>
                )}
              </div>
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {editingVaccineName && (
        <EditVaccineRecordModal
          open={!!editingVaccineName}
          onOpenChange={(open) => !open && setEditingVaccineName(null)}
          pregnancyId={pregnancyId}
          vaccineName={editingVaccineName}
          record={editingRecord}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}

// ── Section: Outros Exames ────────────────────────────────────────────────────

function OtherExamsSection({
  pregnancyId,
  otherExams,
  onRefresh,
}: {
  pregnancyId: string;
  otherExams: Tables<"other_exams">[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <SectionHeader
        icon={TestTube2}
        title="Outros Exames"
        action={
          <>
            <Button
              size="icon"
              className="gradient-primary sm:hidden"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </>
        }
      />

      {otherExams.length === 0 ? (
        <EmptyState
          icon={TestTube2}
          title="Nenhum exame registrado"
          description="Registre exames como CTG, NST e outros não estruturados."
        >
          <Button size="sm" className="gradient-primary" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Adicionar exame
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {otherExams.map((exam) => (
            <div key={exam.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">{exam.description}</p>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {dayjs(exam.exam_date).format("DD/MM/YYYY")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddOtherExamModal
        open={showModal}
        onOpenChange={setShowModal}
        pregnancyId={pregnancyId}
        onSuccess={onRefresh}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type PrenatalCardProps = {
  patientId: string;
  pregnancyId: string | null | undefined;
};

export default function PrenatalCard({ patientId, pregnancyId }: PrenatalCardProps) {
  const { execute: fetchData, result, isPending } = useAction(getPrenatalCardAction);

  const refresh = useCallback(() => {
    if (pregnancyId) fetchData({ patientId, pregnancyId });
  }, [fetchData, patientId, pregnancyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!pregnancyId) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="Nenhuma gestação ativa"
        description="Não há gestação ativa registrada para exibir o cartão pré-natal."
      />
    );
  }

  if (isPending && !result.data) {
    return (
      <div className="space-y-4 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const data = result.data ?? {
    patient: null,
    pregnancy: null,
    obstetricHistory: null,
    riskFactors: null,
    evolutions: [],
    ultrasounds: [],
    labExams: [],
    vaccines: [],
    otherExams: [],
  };

  return (
    <div className="space-y-6 pt-2">
      <GeneralDataSection
        patientId={patientId}
        pregnancyId={pregnancyId}
        data={data}
        onRefresh={refresh}
      />

      <Separator />

      <ObstetricHistorySection
        patientId={patientId}
        pregnancyId={pregnancyId}
        history={data.obstetricHistory}
        pregnancy={data.pregnancy}
        onRefresh={refresh}
      />

      <Separator />

      <RiskFactorsSection
        pregnancyId={pregnancyId}
        riskFactors={data.riskFactors}
        onRefresh={refresh}
      />

      <Separator />

      <EvolutionsSection
        pregnancyId={pregnancyId}
        evolutions={data.evolutions}
        onRefresh={refresh}
      />

      <Separator />

      <UltrasoundsSection
        pregnancyId={pregnancyId}
        ultrasounds={data.ultrasounds}
        onRefresh={refresh}
      />

      <Separator />

      <LabExamsSection pregnancyId={pregnancyId} labExams={data.labExams} onRefresh={refresh} />

      <Separator />

      <VaccinesSection pregnancyId={pregnancyId} vaccines={data.vaccines} onRefresh={refresh} />

      <Separator />

      <OtherExamsSection
        pregnancyId={pregnancyId}
        otherExams={data.otherExams}
        onRefresh={refresh}
      />
    </div>
  );
}
