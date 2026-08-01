import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/UserAvatar",
  component: UserAvatar,
  tags: ["autodocs"],
  argTypes: {
    size: { control: { type: "number", min: 6, max: 20, step: 1 } },
  },
  args: {
    user: { name: "Maria da Silva", avatar_url: null },
    size: 8,
  },
} satisfies Meta<typeof UserAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InitialsFallback: Story = {};

export const SingleName: Story = {
  args: { user: { name: "Madonna", avatar_url: null } },
};

export const WithImage: Story = {
  args: {
    user: { name: "Ana Costa", avatar_url: "https://i.pravatar.cc/150?img=32" },
  },
};

export const LargeSize: Story = {
  args: { size: 16 },
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-3">
      <UserAvatar user={{ name: "Maria da Silva" }} size={6} />
      <UserAvatar user={{ name: "Maria da Silva" }} size={10} />
      <UserAvatar user={{ name: "Maria da Silva" }} size={14} />
    </div>
  ),
};
