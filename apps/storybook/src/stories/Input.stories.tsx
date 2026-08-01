import { Input } from "@ventre/ui/input";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "date", "search", "tel"],
    },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
  args: {
    type: "text",
    placeholder: "Digite aqui...",
    disabled: false,
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Campo desabilitado" },
};

export const DateType: Story = {
  args: { type: "date" },
};

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Input placeholder="Padrão" />
      <Input placeholder="Com valor" defaultValue="Maria da Silva" />
      <Input placeholder="Desabilitado" disabled />
      <Input type="date" />
    </div>
  ),
};
