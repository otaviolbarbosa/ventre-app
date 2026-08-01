import { Button } from "@ventre/ui/button";
import { Mail } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "destructive-outline",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "xl", "icon", "icon-sm"],
    },
    shadow: {
      control: "select",
      options: ["none", "inner", "outter"],
    },
    disabled: { control: "boolean" },
    asChild: { control: false },
  },
  args: {
    children: "Salvar",
    variant: "default",
    size: "default",
    shadow: "none",
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="destructive-outline">Destructive outline</Button>
    </div>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra large</Button>
      <Button size="icon" aria-label="Enviar">
        <Mail />
      </Button>
      <Button size="icon-sm" aria-label="Enviar">
        <Mail />
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithIcon: Story = {
  render: () => (
    <Button>
      <Mail />
      Enviar e-mail
    </Button>
  ),
};
