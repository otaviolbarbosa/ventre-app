import { DatePicker } from "@ventre/ui/shared/date-picker";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
  args: { selected: null, onChange: () => undefined },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function DatePickerExample() {
      const [date, setDate] = useState<Date | null>(null);
      return <DatePicker selected={date} onChange={setDate} placeholderText="Selecione uma data" />;
    }
    return <DatePickerExample />;
  },
};

export const WithMinMaxDate: Story = {
  render: () => {
    function DatePickerExample() {
      const [date, setDate] = useState<Date | null>(new Date());
      const today = new Date();
      const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const maxDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return (
        <DatePicker
          selected={date}
          onChange={setDate}
          minDate={minDate}
          maxDate={maxDate}
          placeholderText="Apenas o mês atual"
        />
      );
    }
    return <DatePickerExample />;
  },
};

export const Disabled: Story = {
  render: () => (
    <DatePicker
      selected={null}
      onChange={() => undefined}
      disabled
      placeholderText="Desabilitado"
    />
  ),
};
