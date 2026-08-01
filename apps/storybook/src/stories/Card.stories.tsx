import { Button } from "@ventre/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ventre/ui/card";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Próxima consulta</CardTitle>
        <CardDescription>Acompanhamento pré-natal</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Maria da Silva — 12/08/2026 às 14:30. Trazer exames de sangue mais recentes.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm">
          Reagendar
        </Button>
        <Button size="sm">Confirmar</Button>
      </CardFooter>
    </Card>
  ),
};

export const HeaderOnly: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Resumo</CardTitle>
        <CardDescription>Sem conteúdo adicional</CardDescription>
      </CardHeader>
    </Card>
  ),
};
