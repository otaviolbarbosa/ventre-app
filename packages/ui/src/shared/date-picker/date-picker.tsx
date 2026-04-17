"use client";

import { CalendarIcon } from "lucide-react";
import type React from "react";
import { forwardRef } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { InputMask } from "@react-input/mask";
import { Input } from "@ventre/ui/input";

export interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholderText?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  dateFormat?: string;
  className?: string;
}

const CustomInput = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ value, onClick, placeholder, ...props }, ref) => (
    <div className="relative w-full">
      <Input
        ref={ref}
        value={value}
        onClick={onClick}
        placeholder={placeholder}
        readOnly
        className="cursor-pointer pr-10"
        {...props}
      />
      {!props.disabled && (
        <CalendarIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 h-4 w-4 text-muted-foreground" />
      )}
    </div>
  ),
);
CustomInput.displayName = "DatePickerCustomInput";

export function DatePicker({
  selected,
  onChange,
  placeholderText,
  disabled,
  minDate,
  maxDate,
  dateFormat = "dd/MM/yyyy",
  className,
}: DatePickerProps) {
  return (
    <div className="lumiar-datepicker-wrapper">
      <ReactDatePicker
        selected={selected}
        onChange={onChange}
        placeholderText={placeholderText}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        dateFormat={dateFormat}
        className={className}
        customInput={
          <InputMask component={CustomInput} mask="__/__/____" replacement={{ _: /\d/ }} />
        }
      />
    </div>
  );
}
