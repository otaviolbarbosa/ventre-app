import { Code } from "@ventre/ui/code";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Code",
  component: Code,
  tags: ["autodocs"],
  args: {
    children: "npm install @ventre/ui",
  },
} satisfies Meta<typeof Code>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <pre className="rounded-md bg-muted p-3 text-sm">
      <Code {...args} />
    </pre>
  ),
};
