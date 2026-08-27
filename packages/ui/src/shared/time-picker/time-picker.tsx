"use client";

import { ClockIcon } from "lucide-react";
import type React from "react";
import { forwardRef } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { InputMask } from "@react-input/mask";
import { Input } from "@ventre/ui/input";
import { cn } from "@ventre/ui/utils";

export interface TimePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholderText?: string;
  disabled?: boolean;
  timeIntervals?: number;
  minTime?: Date;
  maxTime?: Date;
  className?: string;
  /** Quando `true`, oculta o dropdown de horários pré-definidos — o campo continua editável via digitação. */
  hidePredefinedTimes?: boolean;
}

type CustomInputProps = React.ComponentProps<"input"> & { readOnly?: boolean };

const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
  ({ value, onClick, placeholder, readOnly = true, ...props }, ref) => (
    <div className="relative w-full">
      <Input
        ref={ref}
        value={value}
        onClick={onClick}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn("w-full", readOnly && "cursor-pointer")}
        {...props}
      />
      <ClockIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 h-4 w-4 text-muted-foreground" />
    </div>
  ),
);
CustomInput.displayName = "TimePickerCustomInput";

export function TimePicker({
  selected,
  onChange,
  placeholderText = "00:00",
  disabled,
  timeIntervals = 5,
  minTime = new Date(new Date().setHours(7, 0, 0, 0)),
  maxTime = new Date(new Date().setHours(20, 0, 0, 0)),
  className,
  hidePredefinedTimes = false,
}: TimePickerProps) {
  return (
    <div className="lumiar-timepicker-wrapper">
      <ReactDatePicker
        selected={selected}
        onChange={onChange}
        placeholderText={placeholderText}
        disabled={disabled}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={timeIntervals}
        timeCaption="Horário"
        dateFormat="HH:mm"
        timeFormat="HH:mm"
        minTime={minTime}
        maxTime={maxTime}
        className={className}
        open={hidePredefinedTimes ? false : undefined}
        customInput={
          <InputMask
            component={CustomInput}
            mask="__:__"
            replacement={{ _: /\d/ }}
            readOnly={!hidePredefinedTimes}
          />
        }
        showTimeCaption={false}
      />
    </div>
  );
}
