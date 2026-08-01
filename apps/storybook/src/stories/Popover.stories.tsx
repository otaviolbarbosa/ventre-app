import { Button } from "@ventre/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ventre/ui/popover";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Abrir popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-1">
          <h4 className="font-medium text-sm">Dimensões</h4>
          <p className="text-muted-foreground text-sm">Defina a largura e altura do elemento.</p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
