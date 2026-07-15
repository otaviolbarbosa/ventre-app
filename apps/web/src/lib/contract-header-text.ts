import type { ContractHeaderData } from "@/services/base-contract";
import type { Tables } from "@ventre/supabase/types";
import { dayjs } from "./dayjs";

const na = "[não informado]";

type PatientRow = Pick<
  Tables<"patients">,
  "name" | "email" | "phone" | "date_of_birth" | "rg" | "cpf" | "marital_status" | "occupation"
>;

const MARITAL_STATUS_LABELS: Record<string, string> = {
  solteira: "solteira",
  casada: "casada",
  uniao_estavel: "em união estável",
  divorciada: "divorciada",
  viuva: "viúva",
};
type PregnancyRow = Pick<Tables<"pregnancies">, "due_date"> | null;

type TeamMember = {
  id: string;
  name: string | null;
  professional_type: string | null;
  email: string | null;
  phone: string | null;
};

type PersonalHeaderData = { type: "team-personal"; teamMembers: TeamMember[] };

export type ContractHeaderBlocks = {
  contratanteBlock: string;
  contratadaBlock: string;
  teamMembersBlock: string | null;
};

export function buildContractHeaderBlocks(
  patient: PatientRow,
  pregnancy: PregnancyRow,
  headerData: ContractHeaderData | PersonalHeaderData,
): ContractHeaderBlocks {
  const dueDateFormatted = pregnancy?.due_date
    ? dayjs(pregnancy.due_date).format("DD/MM/YYYY")
    : na;

  const maritalStatusLabel = patient.marital_status
    ? (MARITAL_STATUS_LABELS[patient.marital_status] ?? patient.marital_status)
    : na;

  const contratanteBlock = [
    `${patient.name ?? na},`,
    `CPF: ${patient.cpf ?? na}, RG: ${patient.rg ?? na},`,
    `estado civil: ${maritalStatusLabel}, profissão: ${patient.occupation ?? na},`,
    `${patient.email ?? na}, telefone: ${patient.phone ?? na}`,
    `e data provável de parto: ${dueDateFormatted},`,
    "doravante denominada simplesmente GESTANTE.",
  ].join(" ");

  if (headerData.type === "team-personal") {
    const contratadaBlock =
      headerData.teamMembers.length > 0
        ? headerData.teamMembers
            .map(
              (m) =>
                `${m.name ?? na}, ${m.professional_type ?? na}, ${m.email ?? na}, telefone: ${m.phone ?? na}`,
            )
            .join("\n")
        : na;

    return { contratanteBlock, contratadaBlock, teamMembersBlock: null };
  }

  const contratadaBlock =
    headerData.type === "enterprise" && headerData.enterprise
      ? [
          `${headerData.enterprise.legal_name ?? headerData.enterprise.name ?? na}, pessoa jurídica de direito privado,`,
          `inscrita no CNPJ sob nº ${headerData.enterprise.cnpj ?? na},`,
          `com sede à ${
            [
              headerData.enterprise.street,
              headerData.enterprise.number,
              headerData.enterprise.neighborhood,
              headerData.enterprise.city,
              headerData.enterprise.state,
            ]
              .filter(Boolean)
              .join(", ") || na
          },`,
          "doravante denominada simplesmente EQUIPE DE CUIDADO.",
        ].join(" ")
      : headerData.type === "autonomous"
        ? `${headerData.user.name ?? na}, ${headerData.user.professional_type ?? na}, ${headerData.user.email ?? na}, telefone: ${headerData.user.phone ?? na}, doravante denominada simplesmente EQUIPE DE CUIDADO.`
        : na;

  const teamMembersBlock =
    headerData.type === "enterprise" && headerData.teamMembers.length > 0
      ? headerData.teamMembers
          .map(
            (m) =>
              `${m.name ?? na}, ${m.professional_type ?? na}, ${m.email ?? na}, ${m.phone ?? na}`,
          )
          .join("\n")
      : null;

  return { contratanteBlock, contratadaBlock, teamMembersBlock };
}
