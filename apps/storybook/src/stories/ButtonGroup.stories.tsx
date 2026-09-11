import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "@ventre/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@ventre/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ventre/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const meta = {
  title: "Primitives/ButtonGroup",
  component: ButtonGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Um</Button>
      <Button variant="outline">Dois</Button>
    </ButtonGroup>
  ),
};

export const SplitWithDropdown: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Exportar em PDF</Button>
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Exportar para Excel</DropdownMenuItem>
          <DropdownMenuItem>Exportar para CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  ),
};
