import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Label",
  component: Label,
  tags: ["autodocs"],
  args: {
    children: "Nome completo",
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithInput: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex w-64 flex-col gap-2">
      <Label htmlFor="name">Nome completo</Label>
      <Input id="name" placeholder="Maria da Silva" />
    </div>
  ),
};
