import { Button } from "@ventre/ui/button";
import { Toaster } from "@ventre/ui/sonner";
import { toast } from "sonner";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Sonner (Toaster)",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "O `<Toaster />` já está montado globalmente pelo preview do Storybook — os botões abaixo disparam toasts reais via `sonner`.",
      },
    },
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast("Evento criado")}>
        Toast padrão
      </Button>
      <Button variant="outline" onClick={() => toast.success("Paciente salva com sucesso")}>
        Sucesso
      </Button>
      <Button variant="outline" onClick={() => toast.error("Não foi possível salvar")}>
        Erro
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Consulta remarcada", {
            description: "Nova data: 20/08/2026 às 10:00",
          })
        }
      >
        Com descrição
      </Button>
    </div>
  ),
};
