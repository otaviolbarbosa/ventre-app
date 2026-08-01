import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@ventre/ui/select";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Select defaultValue="a-negativo">
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Selecione o tipo sanguíneo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a-positivo">A+</SelectItem>
        <SelectItem value="a-negativo">A-</SelectItem>
        <SelectItem value="b-positivo">B+</SelectItem>
        <SelectItem value="b-negativo">B-</SelectItem>
        <SelectItem value="o-positivo">O+</SelectItem>
        <SelectItem value="o-negativo">O-</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const GroupedWithLabels: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Selecione um profissional" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Obstetras</SelectLabel>
          <SelectItem value="dra-ana">Dra. Ana Costa</SelectItem>
          <SelectItem value="dr-paulo">Dr. Paulo Lima</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Doulas</SelectLabel>
          <SelectItem value="joana">Joana Ribeiro</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Indisponível" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Opção A</SelectItem>
      </SelectContent>
    </Select>
  ),
};
