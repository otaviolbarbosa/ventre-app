import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { DataTable } from "@ventre/ui/shared/data-table";
import type { DataTableColumn } from "@ventre/ui/shared/data-table";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

type Patient = Tables<"patients">;

const meta = {
  title: "Shared/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Tabela genérica com busca, paginação e coluna de ações — tipada por `Model` (linhas do Supabase). O botão de editar usa `next/navigation#redirect`, mockado automaticamente pelo `@storybook/nextjs`.",
      },
    },
  },
  args: {
    data: [],
    totalPages: 0,
    options: { modelName: "", path: "", fieldsToSearch: [] },
    fetchData: () => undefined,
  },
} satisfies Meta<typeof DataTable<Patient>>;

export default meta;
type Story = StoryObj<typeof meta>;

function buildPatient(overrides: Partial<Patient>): Patient {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: "Maria da Silva",
    phone: "(11) 99999-0000",
    email: "maria@exemplo.com",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "00000000-0000-0000-0000-000000000000",
    user_id: null,
    allergies: null,
    blood_type: null,
    cpf: null,
    date_of_birth: null,
    family_history_diabetes: null,
    family_history_hypertension: null,
    family_history_others: null,
    family_history_twin: null,
    height_cm: null,
    marital_status: null,
    occupation: null,
    partner_name: null,
    personal_notes: null,
    rg: null,
    ...overrides,
  };
}

const patients: Patient[] = [
  buildPatient({ name: "Maria da Silva", phone: "(11) 99999-0000", email: "maria@exemplo.com" }),
  buildPatient({ name: "Joana Ribeiro", phone: "(11) 98888-1111", email: "joana@exemplo.com" }),
  buildPatient({ name: "Ana Costa", phone: "(11) 97777-2222", email: "ana@exemplo.com" }),
];

const columns: DataTableColumn<Patient>[] = [
  { label: "Nome", name: "name" },
  { label: "Telefone", name: "phone" },
  { label: "E-mail", name: "email" },
  {
    label: "Status",
    name: "user_id",
    callback: (patient) => (
      <Badge variant={patient.user_id ? "success" : "secondary"}>
        {patient.user_id ? "Convidada" : "Sem acesso"}
      </Badge>
    ),
  },
];

export const Playground: Story = {
  render: () => {
    function Example() {
      const [data] = useState(patients);
      return (
        <DataTable<Patient>
          data={data}
          totalPages={1}
          options={{
            modelName: "patients",
            path: "patients",
            fieldsToSearch: ["name", "email", "phone"],
            columns,
            actions: ["edit", "delete"],
          }}
          fetchData={() => undefined}
          onDeleteAction={() => undefined}
        />
      );
    }
    return <Example />;
  },
};

export const Empty: Story = {
  render: () => (
    <DataTable<Patient>
      data={[]}
      totalPages={1}
      options={{
        modelName: "patients",
        path: "patients",
        fieldsToSearch: ["name"],
        columns,
      }}
      fetchData={() => undefined}
    />
  ),
};
