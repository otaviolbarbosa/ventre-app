import { TimePicker } from "@ventre/ui/shared/time-picker";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/TimePicker",
  component: TimePicker,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
  args: { selected: null, onChange: () => undefined },
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function TimePickerExample() {
      const [time, setTime] = useState<Date | null>(null);
      return <TimePicker selected={time} onChange={setTime} />;
    }
    return <TimePickerExample />;
  },
};

export const CustomInterval: Story = {
  render: () => {
    function TimePickerExample() {
      const [time, setTime] = useState<Date | null>(null);
      return <TimePicker selected={time} onChange={setTime} timeIntervals={30} />;
    }
    return <TimePickerExample />;
  },
};

export const Disabled: Story = {
  render: () => <TimePicker selected={null} onChange={() => undefined} disabled />,
};
