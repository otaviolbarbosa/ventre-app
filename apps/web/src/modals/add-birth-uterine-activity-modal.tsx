"use client";

import { addBirthUterineActivityAction } from "@/actions/add-birth-uterine-activity-action";
import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
import { computeDuNotations } from "@/lib/birth-mode-uterine-activity-utils";
import { dayjs } from "@/lib/dayjs";
import {
  type BirthUterineActivityInput,
  birthUterineActivitySchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const INTERVAL_OPTIONS = [10, 20, 30] as const;

type AddBirthUterineActivityModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

function emptyDefaults() {
  return {
    interval_minutes: undefined,
    contraction_count: undefined,
    durations_seconds: [],
    du_notations: [],
    ...defaultBirthEventDateTime(),
  };
}

export function AddBirthUterineActivityModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthUterineActivityModalProps) {
  const { executeAsync: addUterineActivity, isPending } = useAction(addBirthUterineActivityAction);

  const form = useForm<BirthUterineActivityInput>({
    resolver: zodResolver(birthUterineActivitySchema),
    defaultValues: emptyDefaults() as unknown as BirthUterineActivityInput,
  });

  useEffect(() => {
    if (open) {
      form.reset(emptyDefaults() as unknown as BirthUterineActivityInput);
    }
  }, [open, form]);

  const intervalMinutes = form.watch("interval_minutes");
  const contractionCount = form.watch("contraction_count");
  const durationsSeconds = form.watch("durations_seconds");

  // Dimensiona durations_seconds a partir de contraction_count, preservando
  // valores já digitados por índice — mesmo padrão de new-billing-modal.tsx
  // (installments_dates/installment_count).
  useEffect(() => {
    const current = form.getValues("durations_seconds") ?? [];
    const next = Array.from({ length: contractionCount || 0 }, (_, i) => current[i]);
    form.setValue("durations_seconds", next as unknown as number[]);
  }, [contractionCount, form]);

  const duNotations = useMemo(() => {
    if (!intervalMinutes) return [];
    const validDurations = (durationsSeconds ?? []).filter(
      (d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0,
    );
    if (validDurations.length === 0) return [];
    return computeDuNotations({
      interval_minutes: intervalMinutes,
      durations_seconds: validDurations,
    });
  }, [intervalMinutes, durationsSeconds]);

  useEffect(() => {
    form.setValue("du_notations", duNotations.length > 0 ? duNotations : []);
  }, [duNotations, form]);

  async function onSubmit(values: BirthUterineActivityInput) {
    const result = await addUterineActivity({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Dinâmica uterina registrada!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou dinâmica uterina há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Dinâmica Uterina"
      description="Informe a quantidade de contrações, o intervalo e as durações"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="interval_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Intervalo *</FormLabel>
                <FormControl>
                  <div role="radiogroup" aria-label="Intervalo" className="grid grid-cols-3 gap-2">
                    {INTERVAL_OPTIONS.map((minutes) => {
                      const selected = field.value === minutes;
                      return (
                        <label
                          key={minutes}
                          className={`flex cursor-pointer items-center justify-center rounded-xl border py-3 font-semibold transition-colors ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="interval_minutes"
                            value={minutes}
                            checked={selected}
                            onChange={() => field.onChange(minutes)}
                            className="sr-only"
                          />
                          {minutes} min
                        </label>
                      );
                    })}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contraction_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade de contrações *</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {(contractionCount ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: contractionCount }, (_, i) => (
                <FormField
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  key={`duration-${i}`}
                  control={form.control}
                  name={`durations_seconds.${i}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{i + 1}ª (s) *</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          )}

          {duNotations.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center">
              <p className="font-bold text-2xl text-primary">{duNotations.join("  ")}</p>
            </div>
          )}

          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Data *</FormLabel>
                  <FormControl>
                    <DatePicker
                      selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                      onChange={(date) =>
                        field.onChange(date ? date.toISOString().slice(0, 10) : "")
                      }
                      placeholderText="Selecione a data"
                      hideCalendar
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora *</FormLabel>
                  <FormControl>
                    <TimePicker
                      selected={field.value ? new Date(`1970-01-01T${field.value}:00`) : null}
                      onChange={(date) => field.onChange(date ? dayjs(date).format("HH:mm") : "")}
                      timeIntervals={1}
                      hidePredefinedTimes
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
