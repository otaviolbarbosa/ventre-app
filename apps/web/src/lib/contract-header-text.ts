import type { ContractHeaderData } from "@/services/base-contract"
import type { Tables } from "@ventre/supabase/types"

const na = "[não informado]"

type PatientRow = Pick<Tables<"patients">, "name" | "email" | "phone" | "date_of_birth">
type PregnancyRow = Pick<Tables<"pregnancies">, "due_date"> | null

type TeamMember = { id: string; name: string | null; professional_type: string | null; email: string | null; phone: string | null }

type PersonalHeaderData = { type: "team-personal"; teamMembers: TeamMember[] }

export type ContractHeaderBlocks = {
  contratanteBlock: string
  contratadaBlock: string
  teamMembersBlock: string | null
}

export function buildContractHeaderBlocks(
  patient: PatientRow,
  pregnancy: PregnancyRow,
  headerData: ContractHeaderData | PersonalHeaderData,
): ContractHeaderBlocks {
  const dueDateFormatted = pregnancy?.due_date
    ? new Date(pregnancy.due_date).toLocaleDateString("pt-BR")
    : na

  const contratanteBlock = [
    `${patient.name ?? na},`,
    `CPF: ${na}, RG: ${na},`,
    `${na},`,
    `${patient.email ?? na}, telefone: ${patient.phone ?? na}`,
    `e data provável de parto: ${dueDateFormatted},`,
    "doravante denominada simplesmente GESTANTE.",
  ].join(" ")

  if (headerData.type === "team-personal") {
    const contratadaBlock =
      headerData.teamMembers.length > 0
        ? headerData.teamMembers
            .map(
              (m) =>
                `${m.name ?? na}, ${m.professional_type ?? na}, ${m.email ?? na}, telefone: ${m.phone ?? na}`,
            )
            .join("\n")
        : na

    return { contratanteBlock, contratadaBlock, teamMembersBlock: null }
  }

  const contratadaBlock =
    headerData.type === "enterprise" && headerData.enterprise
      ? [
          `${headerData.enterprise.legal_name ?? headerData.enterprise.name ?? na}, pessoa jurídica de direito privado,`,
          `inscrita no CNPJ sob nº ${headerData.enterprise.cnpj ?? na},`,
          `com sede à ${[
            headerData.enterprise.street,
            headerData.enterprise.number,
            headerData.enterprise.neighborhood,
            headerData.enterprise.city,
            headerData.enterprise.state,
          ]
            .filter(Boolean)
            .join(", ") || na},`,
          "doravante denominada simplesmente EQUIPE DE CUIDADO.",
        ].join(" ")
      : headerData.type === "autonomous"
        ? `${headerData.user.name ?? na}, ${headerData.user.professional_type ?? na}, ${headerData.user.email ?? na}, telefone: ${headerData.user.phone ?? na}, doravante denominada simplesmente EQUIPE DE CUIDADO.`
        : na

  const teamMembersBlock =
    headerData.type === "enterprise" && headerData.teamMembers.length > 0
      ? headerData.teamMembers
          .map(
            (m) =>
              `${m.name ?? na}, ${m.professional_type ?? na}, ${m.email ?? na}, ${m.phone ?? na}`,
          )
          .join("\n")
      : null

  return { contratanteBlock, contratadaBlock, teamMembersBlock }
}
