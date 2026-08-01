import { LoadingData } from "@ventre/ui/shared/loading-data";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/LoadingData",
  component: LoadingData,
  tags: ["autodocs"],
  argTypes: {
    display: { control: "boolean" },
  },
  args: {
    display: true,
  },
} satisfies Meta<typeof LoadingData>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="relative h-48 w-72 rounded-lg border">
      <p className="p-4 text-sm">Conteúdo por trás do overlay de carregamento.</p>
      <LoadingData {...args} />
    </div>
  ),
};

export const Hidden: Story = {
  args: { display: false },
  render: (args) => (
    <div className="relative h-48 w-72 rounded-lg border">
      <p className="p-4 text-sm">Overlay oculto quando `display` é falso.</p>
      <LoadingData {...args} />
    </div>
  ),
};
