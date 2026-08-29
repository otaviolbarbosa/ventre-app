import {
  Activity,
  Baby,
  Droplet,
  HeartPulse,
  type LucideIcon,
  PlayCircle,
  Ruler,
  TestTube,
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

export const BIRTH_PAIN_INTENSITY_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: "fraca", emoji: "😑", label: "Fraca" },
  { value: "fraca_media", emoji: "😟", label: "Fraca p/ Média" },
  { value: "media", emoji: "😧", label: "Média" },
  { value: "media_forte", emoji: "😖", label: "Média p/ Forte" },
  { value: "forte", emoji: "😫", label: "Forte" },
];

export const BIRTH_PAIN_INTENSITY_LABELS: Record<string, string> = Object.fromEntries(
  BIRTH_PAIN_INTENSITY_OPTIONS.map(({ value, emoji, label }) => [value, `${emoji} ${label}`]),
);

export const BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS: Record<string, string> = {
  espontanea: "Espontânea",
  artificial: "Artificial",
};

export const BIRTH_MODE_LABOUR_TYPE_LABELS: Record<string, string> = {
  espontaneo: "Espontâneo",
  induzido: "Induzido",
};

export const BIRTH_MODE_INDUCTION_TYPE_LABELS: Record<string, string> = {
  balao: "Balão",
  misoprostol: "Misoprostol",
  ocitocina: "Ocitocina",
};

export const BIRTH_URINE_DIPSTICK_LABELS: Record<string, string> = {
  ausente: "Ausente",
  tracos: "Traços",
  uma_cruz: "+",
  duas_cruzes: "++",
  tres_cruzes: "+++",
};

export type BirthEventType =
  | "start_monitoring"
  | "contraction"
  | "cervical_dilation"
  | "fetal_station"
  | "fetal_heart_rate"
  | "amniotic_fluid"
  | "medication"
  | "membrane_rupture"
  | "maternal_vitals"
  | "urine_test"
  | "apgar";

export const BIRTH_EVENT_CONFIG: Record<
  BirthEventType,
  { label: string; icon: LucideIcon; colorClass: string }
> = {
  start_monitoring: {
    label: "Início do acompanhamento",
    icon: PlayCircle,
    colorClass: "text-primary",
  },
  contraction: { label: "Dinâmica Uterina", icon: Activity, colorClass: "text-pink-500" },
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
  maternal_vitals: { label: "Vitais maternos", icon: HeartPulse, colorClass: "text-rose-500" },
  urine_test: { label: "Urina", icon: TestTube, colorClass: "text-lime-600" },
  apgar: { label: "Apgar", icon: Baby, colorClass: "text-indigo-500" },
};

export const BIRTH_EVENT_TYPES: {
  type: Exclude<BirthEventType, "start_monitoring" | "apgar">;
  cardinality: "multiple" | "single";
}[] = [
  { type: "contraction", cardinality: "multiple" },
  { type: "cervical_dilation", cardinality: "multiple" },
  { type: "fetal_station", cardinality: "multiple" },
  { type: "fetal_heart_rate", cardinality: "multiple" },
  { type: "amniotic_fluid", cardinality: "multiple" },
  { type: "medication", cardinality: "multiple" },
  { type: "membrane_rupture", cardinality: "single" },
  { type: "maternal_vitals", cardinality: "multiple" },
  // { type: "urine_test", cardinality: "multiple" },
];
