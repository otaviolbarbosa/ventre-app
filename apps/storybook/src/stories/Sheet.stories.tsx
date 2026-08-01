import { Button } from "@ventre/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@ventre/ui/sheet";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const sides = ["top", "right", "bottom", "left"] as const;

export const Playground: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Abrir painel</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar consulta</SheetTitle>
          <SheetDescription>Ajuste os detalhes do agendamento.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button>Salvar alterações</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {sides.map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="outline" className="capitalize">
              {side}
            </Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle className="capitalize">Painel — {side}</SheetTitle>
              <SheetDescription>Este painel desliza a partir de "{side}".</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

export const MobileConfirmation: Story = {
  globals: { viewport: { value: "mobile" } },
  parameters: {
    docs: { description: { story: "Padrão usado em telas com largura < 640px." } },
  },
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="destructive">Excluir item</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Excluir item</SheetTitle>
          <SheetDescription>
            Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-4 flex-row gap-2">
          <Button variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1">
            Excluir
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};
