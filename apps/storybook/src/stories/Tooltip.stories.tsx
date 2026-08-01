import { Button } from "@ventre/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ventre/ui/tooltip";
import { Info } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Requer um `TooltipProvider` ancestral — já configurado globalmente no preview deste Storybook.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Passe o mouse</Button>
      </TooltipTrigger>
      <TooltipContent>Esta é uma dica de contexto</TooltipContent>
    </Tooltip>
  ),
};

export const OnIcon: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground" aria-label="Mais informações">
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>IMC calculado com base no peso e altura informados</TooltipContent>
    </Tooltip>
  ),
};
