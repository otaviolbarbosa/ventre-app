import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/ContentModal",
  component: ContentModal,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Alterna entre `Dialog` (desktop) e `Sheet` (mobile, `max-width: 639px`) e aceita qualquer conteúdo como filho — use o seletor de viewport da toolbar, ou veja as stories **Mobile**/**Desktop** abaixo, que já forçam cada breakpoint.",
      },
    },
  },
  args: {
    open: false,
    onOpenChange: () => undefined,
    title: "",
    children: null,
  },
} satisfies Meta<typeof ContentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ContentModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Nova anotação</Button>
      <ContentModal
        open={open}
        onOpenChange={setOpen}
        title="Nova anotação"
        description="Registre observações sobre o atendimento."
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="content-modal-title">Título</Label>
            <Input id="content-modal-title" placeholder="Consulta de rotina" />
          </div>
          <Button className="justify-self-end" onClick={() => setOpen(false)}>
            Salvar
          </Button>
        </div>
      </ContentModal>
    </>
  );
}

export const Playground: Story = {
  render: () => <ContentModalExample />,
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile" } },
  parameters: {
    docs: {
      description: {
        story: "Abaixo de 640px, o componente renderiza como `Sheet` (bottom sheet).",
      },
    },
  },
  render: () => <ContentModalExample />,
};

export const Desktop: Story = {
  globals: { viewport: { value: "desktop" } },
  parameters: {
    docs: {
      description: {
        story: "A partir de 640px, o componente renderiza como `Dialog` centralizado.",
      },
    },
  },
  render: () => <ContentModalExample />,
};
