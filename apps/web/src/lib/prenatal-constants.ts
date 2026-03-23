import type { ObstetricHistoryInput, RiskFactorsInput } from "@/lib/validations/prenatal";

export const AMNIOTIC_FLUID_INDEX_LABELS: Record<string, string> = {
  severe_oligohydramnios: "Oligodrâmnio grave (< 2 cm)",
  oligohydramnios: "Oligodrâmnio (2–5 cm)",
  normal: "Normal (5–25 cm)",
  polyhydramnios: "Polidrâmnio (> 25 cm)",
};

export const FETAL_PRESENTATION_LABELS: Record<string, string> = {
  cephalic: "Cefálica",
  pelvic: "Pélvica",
  transverse: "Transversa",
};

export const DOPPLER_RESULT_LABELS: Record<string, string> = {
  normal: "Normal",
  abnormal: "Alterado",
  not_performed: "Não realizado",
};

export const HEMOGLOBIN_LABELS: Record<string, string> = {
  AA: "AA",
  AS: "AS",
  AC: "AC",
  SS: "SS",
  SC: "SC",
  other_heterozygous: "Outro heterozigoto",
  other_homozygous: "Outro homozigoto",
};

export const VACCINE_LABELS: Record<string, string> = {
  covid: "COVID-19",
  influenza: "Influenza",
  hepatitis_b: "Hepatite B",
  dtpa: "dTpa",
  abrysvo: "Abrysvo (VRS)",
  rhogam: "Rhogam",
};

export const VACCINE_STATUS_LABELS: Record<string, string> = {
  applied: "Aplicada",
  immunized: "Imune",
  not_applicable: "Não indicada",
};

export const VACCINE_NAMES = [
  "covid",
  "influenza",
  "hepatitis_b",
  "dtpa",
  "abrysvo",
  "rhogam",
] as const;

export const CLINICAL_FIELDS: { name: keyof ObstetricHistoryInput; label: string }[] = [
  { name: "diabetes", label: "Diabetes" },
  { name: "urinary_infection", label: "Infecção urinária" },
  { name: "infertility", label: "Infertilidade" },
  { name: "breastfeeding_difficulty", label: "Dificuldade de amamentação" },
  { name: "cardiopathy", label: "Cardiopatia" },
  { name: "thromboembolism", label: "Tromboembolismo" },
  { name: "hypertension", label: "Hipertensão" },
  { name: "other_clinical", label: "Outros" },
];

export const SURGICAL_FIELDS: { name: keyof ObstetricHistoryInput; label: string }[] = [
  { name: "pelvic_uterine_surgery", label: "Cirurgia pélvica/uterina" },
  { name: "prior_surgery", label: "Cirurgia prévia" },
];

export type RiskGroup = {
  label: string;
  fields: { name: keyof RiskFactorsInput; label: string }[];
};

export const RISK_GROUPS: RiskGroup[] = [
  {
    label: "Estilo de vida",
    fields: [
      { name: "smoking", label: "Tabagismo" },
      { name: "alcohol", label: "Álcool" },
      { name: "other_drugs", label: "Outras drogas" },
      { name: "domestic_violence", label: "Violência doméstica" },
    ],
  },
  {
    label: "Infecções",
    fields: [
      { name: "hiv_aids", label: "HIV/AIDS" },
      { name: "syphilis", label: "Sífilis" },
      { name: "toxoplasmosis", label: "Toxoplasmose" },
      { name: "urinary_infection", label: "Infecção urinária" },
      { name: "fever", label: "Febre" },
    ],
  },
  {
    label: "Condições obstétricas",
    fields: [
      { name: "anemia", label: "Anemia" },
      { name: "isthmocervical_incompetence", label: "Incompetência ístmico-cervical" },
      { name: "preterm_labor_threat", label: "Ameaça de parto prematuro" },
      { name: "rh_isoimmunization", label: "Isoimunização Rh" },
      { name: "oligo_polyhydramnios", label: "Oligo/Polidrâmnio" },
      { name: "premature_membrane_rupture", label: "Rotura prematura de membranas" },
      { name: "iugr", label: "CIUR" },
      { name: "post_term", label: "Pós-maturidade" },
    ],
  },
  {
    label: "Condições maternas",
    fields: [
      { name: "hypertension", label: "Hipertensão" },
      { name: "preeclampsia_eclampsia", label: "Pré-eclâmpsia/Eclâmpsia" },
      { name: "cardiopathy", label: "Cardiopatia" },
      { name: "gestational_diabetes", label: "Diabetes gestacional" },
      { name: "insulin_use", label: "Uso de insulina" },
      { name: "hemorrhage_1st_trimester", label: "Hemorragia 1º trim." },
      { name: "hemorrhage_2nd_trimester", label: "Hemorragia 2º trim." },
      { name: "hemorrhage_3rd_trimester", label: "Hemorragia 3º trim." },
      { name: "exantema", label: "Exantema" },
    ],
  },
];
