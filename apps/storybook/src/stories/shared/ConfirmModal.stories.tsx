import { Button } from "@ventre/ui/button";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { ConfirmModal } from "@ventre/ui/shared/confirm-modal";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/ConfirmModal",
  component: ConfirmModal,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Alterna automaticamente entre `Dialog` (desktop) e `Sheet` (mobile, `< 640px`) — use o seletor de viewport da toolbar, ou veja as stories **Mobile**/**Desktop** abaixo, que já forçam cada breakpoint.",
      },
    },
  },
  args: {
    open: false,
    onOpenChange: () => undefined,
    title: "",
    description: "",
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof ConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ConfirmModalExample({
  variant,
}: { variant: "default" | "destructive" | "destructive-inverted" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant === "default" ? "default" : "destructive"}
        onClick={() => setOpen(true)}
      >
        Abrir confirmação
      </Button>
      <ConfirmModal
        open={open}
        onOpenChange={setOpen}
        title="Excluir paciente"
        description="Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita."
        variant={variant}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <ConfirmModalExample variant="default" />,
};

export const Destructive: Story = {
  render: () => <ConfirmModalExample variant="destructive" />,
};

export const DestructiveInverted: Story = {
  render: () => <ConfirmModalExample variant="destructive-inverted" />,
};

export const Loading: Story = {
  render: () => {
    function LoadingExample() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Abrir confirmação (carregando)
          </Button>
          <ConfirmModal
            open={open}
            onOpenChange={setOpen}
            title="Excluindo paciente..."
            description="Aguarde enquanto processamos a exclusão."
            loading
            onConfirm={() => undefined}
          />
        </>
      );
    }
    return <LoadingExample />;
  },
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
  render: () => <ConfirmModalExample variant="destructive" />,
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
  render: () => <ConfirmModalExample variant="destructive" />,
};

export const ViaConfirmationModalProvider: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Uso recomendado em produção: dispare a confirmação pelo hook `useConfirmModal`, que já é fornecido globalmente neste Storybook via `ConfirmationModalProvider`.",
      },
    },
  },
  render: () => {
    function ProviderExample() {
      const { confirm } = useConfirmModal();
      return (
        <Button
          variant="destructive"
          onClick={() =>
            confirm({
              title: "Excluir paciente",
              description: "Tem certeza que deseja excluir este cadastro?",
              variant: "destructive",
              onConfirm: () => undefined,
            })
          }
        >
          Excluir (via hook)
        </Button>
      );
    }
    return <ProviderExample />;
  },
};
