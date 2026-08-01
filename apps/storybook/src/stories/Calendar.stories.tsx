import { Calendar } from "@ventre/ui/calendar";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => {
    function CalendarStory() {
      const [date, setDate] = useState<Date | undefined>(new Date());
      return (
        <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
      );
    }
    return <CalendarStory />;
  },
};

export const Range: Story = {
  render: () => {
    function CalendarStory() {
      const [range, setRange] = useState<DateRange | undefined>({
        from: new Date(),
      });
      return (
        <Calendar mode="range" selected={range} onSelect={setRange} className="rounded-md border" />
      );
    }
    return <CalendarStory />;
  },
};
