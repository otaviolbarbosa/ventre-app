import { Loading } from "@ventre/ui/shared/loading";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/Loading",
  component: Loading,
  tags: ["autodocs"],
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div className="h-40 w-64">
      <Loading />
    </div>
  ),
};
