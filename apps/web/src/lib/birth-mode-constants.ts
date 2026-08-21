import {
  Activity,
  Baby,
  Droplet,
  HeartPulse,
  type LucideIcon,
  PlayCircle,
  Ruler,
  Waves,
} from "lucide-react";

export const AMNIOTIC_FLUID_TYPE_LABELS: Record<string, string> = {
  // intacto: "Intacto", // não utilizar por enquanto
  claro: "Claro",
  com_meconio: "Com mecônio",
  com_sangue: "Com sangue",
};

export const BIRTH_MEDICATION_TYPE_LABELS: Record<string, string> = {
  fluidos_intravenosos: "Fluidos intravenosos",
  ocitocina: "Ocitocina",
  analgesia: "Analgesia",
  outros: "Outros",
};

export const BIRTH_CONTRACTION_EFFECTIVENESS_LABELS: Record<string, string> = {
  efetiva: "Efetiva",
  intermediaria: "Intermediária",
  nao_efetiva: "Não efetiva",
};

export type BirthEventType =
  | "start_monitoring"
  | "contraction"
  | "cervical_dilation"
  | "fetal_station"
  | "fetal_heart_rate"
  | "amniotic_fluid"
  | "medication"
  | "membrane_rupture";

export const BIRTH_EVENT_CONFIG: Record<
  BirthEventType,
  { label: string; icon: LucideIcon; colorClass: string }
> = {
  start_monitoring: {
    label: "Início do acompanhamento",
    icon: PlayCircle,
    colorClass: "text-primary",
  },
  contraction: { label: "Contração", icon: Activity, colorClass: "text-pink-500" },
  cervical_dilation: { label: "Dilatação cervical", icon: Ruler, colorClass: "text-purple-500" },
  fetal_station: {
    label: "Altura de apresentação (Lee)",
    icon: Baby,
    colorClass: "text-orange-500",
  },
  fetal_heart_rate: { label: "BCF", icon: HeartPulse, colorClass: "text-red-500" },
  amniotic_fluid: { label: "Líquido amniótico", icon: Droplet, colorClass: "text-teal-500" },
  medication: { label: "Medicamento", icon: Waves, colorClass: "text-yellow-500" },
  membrane_rupture: { label: "Bolsa rota", icon: Droplet, colorClass: "text-blue-500" },
};

export const BIRTH_EVENT_TYPES: {
  type: Exclude<BirthEventType, "start_monitoring">;
  cardinality: "multiple" | "single";
}[] = [
  { type: "contraction", cardinality: "multiple" },
  { type: "cervical_dilation", cardinality: "multiple" },
  { type: "fetal_station", cardinality: "multiple" },
  { type: "fetal_heart_rate", cardinality: "multiple" },
  { type: "amniotic_fluid", cardinality: "multiple" },
  { type: "medication", cardinality: "multiple" },
  { type: "membrane_rupture", cardinality: "single" },
];
