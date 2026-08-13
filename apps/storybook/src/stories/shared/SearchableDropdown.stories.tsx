import {
  SearchableDropdown,
  type SearchableDropdownOption,
} from "@ventre/ui/shared/searchable-dropdown";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/SearchableDropdown",
  component: SearchableDropdown,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
  args: { options: [], onChange: () => undefined },
} satisfies Meta<typeof SearchableDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

const professionals: SearchableDropdownOption[] = [
  { value: "ana", label: "Dra. Ana Costa", group: "Obstetras" },
  { value: "paulo", label: "Dr. Paulo Lima", group: "Obstetras" },
  { value: "joana", label: "Joana Ribeiro", group: "Doulas" },
  { value: "beatriz", label: "Beatriz Nunes", group: "Doulas" },
  { value: "carla", label: "Carla Menezes", group: "Nutricionistas" },
];

export const SingleSelect: Story = {
  render: () => {
    function Example() {
      const [value, setValue] = useState("");
      return (
        <SearchableDropdown
          options={professionals}
          value={value}
          onChange={setValue}
          placeholder="Selecione um profissional"
        />
      );
    }
    return <Example />;
  },
};

export const MultipleSelect: Story = {
  render: () => {
    function Example() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <SearchableDropdown
          multiple
          options={professionals}
          value={value}
          onChange={setValue}
          placeholder="Selecione um ou mais profissionais"
        />
      );
    }
    return <Example />;
  },
};

export const MaxSelectedPerGroup: Story = {
  render: () => {
    function Example() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <SearchableDropdown
          multiple
          options={professionals}
          value={value}
          onChange={setValue}
          maxSelectedPerGroup={1}
          placeholder="No máximo 1 por grupo"
        />
      );
    }
    return <Example />;
  },
};

export const Loading: Story = {
  render: () => <SearchableDropdown options={[]} value="" onChange={() => undefined} loading />,
};

export const Disabled: Story = {
  render: () => (
    <SearchableDropdown options={professionals} value="" onChange={() => undefined} disabled />
  ),
};

export const EmptyState: Story = {
  render: () => (
    <SearchableDropdown
      options={[]}
      value=""
      onChange={() => undefined}
      emptyMessage="Nenhum profissional encontrado"
    />
  ),
};
