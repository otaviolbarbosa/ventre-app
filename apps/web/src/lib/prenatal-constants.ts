import type {
  EmotionalPrenatalInput,
  ObstetricHistoryInput,
  RiskFactorsInput,
} from "@/lib/validations/prenatal";

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
  not_applicable: "Não aplicada",
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

export const EMOTIONAL_PRENATAL_INTRO =
  "Aqui, você encontrará perguntas que ajudam a conhecer a história, identificar crenças, medos, expectativas, fortalezas e necessidades emocionais que podem influenciar a experiencia de parto dessa mulher. Permita que a conversa aconteça no tempo dela e utilize este roteiro como um guia, não como um questionário. O objetivo é construir um espaço de escuta, confiança e acolhimento, para que o cuidado seja verdadeiramente individualizado e centrado na mulher.";

export const EMOTIONAL_PRENATAL_QUESTIONS: {
  name: keyof EmotionalPrenatalInput;
  question: string;
}[] = [
  { name: "birth_story", question: "Como você nasceu? Quais histórias você ouviu sobre seu nascimento?" },
  { name: "coping_style", question: "Como você costuma lidar com situações desafiadoras?" },
  { name: "safety_source", question: "O que faz você se sentir segura?" },
  { name: "loss_of_control_feeling", question: "Como você se sente quando perde o controle da situação?" },
  {
    name: "birth_first_image",
    question: "Quando você imagina o parto, qual é a primeira imagem que vem na sua cabeça?",
  },
  { name: "biggest_fear", question: "Qual o seu maior medo?" },
  {
    name: "preserve_if_different",
    question: "Se algo sair diferente do esperado, o que você gostaria de preservar?",
  },
  { name: "woman_reminder", question: "Quem faz você se lembrar da mulher que é?" },
];

export type RiskGroup = {
  label: string;
  fields: { name: keyof RiskFactorsInput; label: string }[];
};

export const RISK_GROUPS: RiskGroup[] = [
  {
    label: "Estilo de vida",
    fields: [
      { name: "alcohol", label: "Álcool" },
      { name: "other_drugs", label: "Outras drogas" },
      { name: "domestic_violence", label: "Violência doméstica" },
      { name: "smoking", label: "Tabagismo" },
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
