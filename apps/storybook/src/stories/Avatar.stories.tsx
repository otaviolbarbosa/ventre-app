import type { Meta, StoryObj } from "@storybook/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";

const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://i.pravatar.cc/150?img=47" alt="Maria da Silva" />
      <AvatarFallback>MS</AvatarFallback>
    </Avatar>
  ),
};

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/broken-image.jpg" alt="Maria da Silva" />
      <AvatarFallback>MS</AvatarFallback>
    </Avatar>
  ),
};

export const MultipleSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs">MS</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10">
        <AvatarFallback>MS</AvatarFallback>
      </Avatar>
      <Avatar className="h-16 w-16">
        <AvatarFallback className="text-lg">MS</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const MultipleSizesWithImage: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar className="h-6 w-6">
        <AvatarImage src="https://i.pravatar.cc/150?img=47" alt="Maria da Silva" />
        <AvatarFallback className="text-xs">MS</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://i.pravatar.cc/150?img=47" alt="Maria da Silva" />
        <AvatarFallback>MS</AvatarFallback>
      </Avatar>
      <Avatar className="h-16 w-16">
        <AvatarImage src="https://i.pravatar.cc/150?img=47" alt="Maria da Silva" />
        <AvatarFallback className="text-lg">MS</AvatarFallback>
      </Avatar>
    </div>
  ),
};
