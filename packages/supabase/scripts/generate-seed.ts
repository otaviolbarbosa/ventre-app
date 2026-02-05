import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { faker } from "@faker-js/faker/locale/pt_BR";
import dayjs from "dayjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração
const DOULA_ID = "6e80c9bc-4fd5-4ac5-962f-508781843d06";
const PASSWORD_HASH = "$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO"; // password123

// Gerar UUIDs
function generateUUID(): string {
  return faker.string.uuid();
}

// Gerar data de DPP entre 30 e 280 dias a partir de hoje
function generateDueDate(): dayjs.Dayjs {
  const daysFromNow = faker.number.int({ min: 30, max: 280 });
  return dayjs().add(daysFromNow, "day");
}

// Calcular DUM a partir da DPP (280 dias antes)
function calculateDUM(dueDate: dayjs.Dayjs): dayjs.Dayjs {
  return dueDate.subtract(280, "day");
}

// Gerar data de nascimento para gestantes (18-40 anos)
function generateBirthDate(): dayjs.Dayjs {
  const age = faker.number.int({ min: 18, max: 40 });
  return dayjs()
    .subtract(age, "year")
    .subtract(faker.number.int({ min: 0, max: 364 }), "day");
}

// Gerar telefone brasileiro
function generatePhone(): string {
  const ddd = faker.helpers.arrayElement([
    "11",
    "21",
    "31",
    "41",
    "51",
    "61",
    "71",
    "81",
    "85",
    "62",
  ]);
  const number = faker.string.numeric(9);
  return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

// Tipos
interface Professional {
  id: string;
  email: string;
  name: string;
  professionalType: "obstetra" | "enfermeiro";
  phone: string;
}

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  dueDate: string;
  dum: string;
  address: string;
}

// Gerar profissionais
function generateProfessionals(): { obstetras: Professional[]; enfermeiras: Professional[] } {
  const obstetras: Professional[] = [];
  const enfermeiras: Professional[] = [];

  // 10 Obstetras
  for (let i = 1; i <= 10; i++) {
    const num = i.toString().padStart(2, "0");
    obstetras.push({
      id: generateUUID(),
      email: `otavioblbarbosa+mo${10 + num}@gmail.com`,
      name: `Dra. ${faker.person.firstName("female")} ${faker.person.lastName()}`,
      professionalType: "obstetra",
      phone: generatePhone(),
    });
  }

  // 10 Enfermeiras Obstétricas
  for (let i = 1; i <= 10; i++) {
    const num = i.toString().padStart(2, "0");
    enfermeiras.push({
      id: generateUUID(),
      email: `otavioblbarbosa+eo${10 + num}@gmail.com`,
      name: `Enf. ${faker.person.firstName("female")} ${faker.person.lastName()}`,
      professionalType: "enfermeiro",
      phone: generatePhone(),
    });
  }

  return { obstetras, enfermeiras };
}

// Gerar pacientes (gestantes)
function generatePatients(): Patient[] {
  const patients: Patient[] = [];

  for (let i = 1; i <= 25; i++) {
    const num = i.toString().padStart(2, "0");
    const dueDate = generateDueDate();
    const dum = calculateDUM(dueDate);

    patients.push({
      id: generateUUID(),
      name: `${faker.person.firstName("female")} ${faker.person.lastName()}`,
      email: `otavioblbarbosa+ge${25 + num}@gmail.com`,
      phone: generatePhone(),
      dateOfBirth: generateBirthDate().format("YYYY-MM-DD"),
      dueDate: dueDate.format("YYYY-MM-DD"),
      dum: dum.format("YYYY-MM-DD"),
      address: `${faker.location.streetAddress()}, ${faker.location.city()} - ${faker.location.state({ abbreviated: true })}`,
    });
  }

  return patients;
}

// Escapar string para SQL
function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

// Gerar SQL
function generateSQL(): string {
  const { obstetras, enfermeiras } = generateProfessionals();
  const patients = generatePatients();
  const now = dayjs().toISOString();

  let sql = `-- Seed gerada em ${now}
-- Senha padrão para todos os usuários: password123

-- Limpar dados existentes (exceto o usuário doula)
DELETE FROM public.team_members WHERE professional_id != '${DOULA_ID}';
DELETE FROM public.patients;
DELETE FROM public.users WHERE id != '${DOULA_ID}';
DELETE FROM auth.users WHERE id != '${DOULA_ID}';

`;

  // Inserir obstetras em auth.users
  sql += `-- ==========================================\n`;
  sql += `-- OBSTETRAS (10)\n`;
  sql += `-- ==========================================\n\n`;

  for (const obstetra of obstetras) {
    sql += `INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '${obstetra.id}',
  'authenticated',
  'authenticated',
  '${obstetra.email}',
  '${PASSWORD_HASH}',
  '${now}',
  '${now}',
  '${now}',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "${escapeSQL(obstetra.name)}", "professional_type": "obstetra", "phone": "${obstetra.phone}"}',
  false,
  ''
);

`;
  }

  // Inserir enfermeiras em auth.users
  sql += `-- ==========================================\n`;
  sql += `-- ENFERMEIRAS OBSTÉTRICAS (10)\n`;
  sql += `-- ==========================================\n\n`;

  for (const enfermeira of enfermeiras) {
    sql += `INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '${enfermeira.id}',
  'authenticated',
  'authenticated',
  '${enfermeira.email}',
  '${PASSWORD_HASH}',
  '${now}',
  '${now}',
  '${now}',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "${escapeSQL(enfermeira.name)}", "professional_type": "enfermeiro", "phone": "${enfermeira.phone}"}',
  false,
  ''
);

`;
  }

  // Inserir pacientes
  sql += `-- ==========================================\n`;
  sql += `-- GESTANTES (25)\n`;
  sql += `-- ==========================================\n\n`;

  for (const patient of patients) {
    sql += `INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '${patient.id}',
  '${escapeSQL(patient.name)}',
  '${patient.email}',
  '${patient.phone}',
  '${patient.dateOfBirth}',
  '${patient.dueDate}',
  '${patient.dum}',
  '${escapeSQL(patient.address)}',
  '${DOULA_ID}'
);

`;
  }

  // Associar TODAS as gestantes à doula
  sql += `-- ==========================================\n`;
  sql += `-- ASSOCIAR TODAS AS GESTANTES À DOULA\n`;
  sql += `-- ==========================================\n\n`;

  for (const patient of patients) {
    sql += `INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('${patient.id}', '${DOULA_ID}', 'doula');

`;
  }

  // Selecionar 10 gestantes aleatórias para obstetras
  const shuffledForObstetras = [...patients].sort(() => Math.random() - 0.5);
  const patientsForObstetras = shuffledForObstetras.slice(0, 10);

  sql += `-- ==========================================\n`;
  sql += `-- ASSOCIAR 10 GESTANTES A OBSTETRAS\n`;
  sql += `-- ==========================================\n\n`;

  for (let i = 0; i < 10; i++) {
    const patient = patientsForObstetras[i];
    const obstetra = obstetras[i];
    sql += `INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('${patient.id}', '${obstetra.id}', 'obstetra');

`;
  }

  // Selecionar 10 gestantes aleatórias para enfermeiras (pode haver sobreposição com obstetras)
  const shuffledForEnfermeiras = [...patients].sort(() => Math.random() - 0.5);
  const patientsForEnfermeiras = shuffledForEnfermeiras.slice(0, 10);

  sql += `-- ==========================================\n`;
  sql += `-- ASSOCIAR 10 GESTANTES A ENFERMEIRAS OBSTÉTRICAS\n`;
  sql += `-- ==========================================\n\n`;

  for (let i = 0; i < 10; i++) {
    const patient = patientsForEnfermeiras[i];
    const enfermeira = enfermeiras[i];
    sql += `INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('${patient.id}', '${enfermeira.id}', 'enfermeiro');

`;
  }

  return sql;
}

// Executar
const sql = generateSQL();
const outputPath = join(__dirname, "..", "supabase", "seed.sql");
writeFileSync(outputPath, sql);

console.log(`Seed gerada em: ${outputPath}`);
console.log(`\nResumo:`);
console.log(`- 10 Obstetras (emails: otavioblbarbosa+mo01@gmail.com até +mo10)`);
console.log(`- 10 Enfermeiras Obstétricas (emails: otavioblbarbosa+eo01@gmail.com até +eo10)`);
console.log(`- 25 Gestantes (emails: otavioblbarbosa+ge01@gmail.com até +ge25)`);
console.log(`- Todas as gestantes associadas à doula (${DOULA_ID})`);
console.log(`- 10 gestantes com obstetras`);
console.log(`- 10 gestantes com enfermeiras`);
console.log(`\nSenha padrão: password123`);
