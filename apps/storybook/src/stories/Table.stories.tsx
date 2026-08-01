import { Badge } from "@ventre/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ventre/ui/table";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, layout: "fullscreen" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const patients = [
  { name: "Maria da Silva", phone: "(11) 99999-0000", status: "Ativo" },
  { name: "Joana Ribeiro", phone: "(11) 98888-1111", status: "Finalizado" },
  { name: "Ana Costa", phone: "(11) 97777-2222", status: "Ativo" },
];

export const Playground: Story = {
  render: () => (
    <div className="p-6">
      <Table>
        <TableCaption>Lista de pacientes cadastradas.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.name}>
              <TableCell>{patient.name}</TableCell>
              <TableCell>{patient.phone}</TableCell>
              <TableCell>
                <Badge variant={patient.status === "Ativo" ? "success" : "secondary"}>
                  {patient.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};
