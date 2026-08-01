import { Textarea } from "@ventre/ui/textarea";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
  args: {
    placeholder: "Escreva uma observação...",
    disabled: false,
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <Textarea className="w-80" {...args} />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Textarea className="w-80" {...args} />,
};
