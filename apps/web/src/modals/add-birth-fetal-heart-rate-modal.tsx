"use client";

import { addBirthFetalHeartRateAction } from "@/actions/add-birth-fetal-heart-rate-action";
import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
import { dayjs } from "@/lib/dayjs";
import {
  type BirthFetalHeartRateInput,
  birthFetalHeartRateSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Slider } from "@ventre/ui/slider";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddBirthFetalHeartRateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthFetalHeartRateModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthFetalHeartRateModalProps) {
  const { executeAsync: addHeartRate, isPending } = useAction(addBirthFetalHeartRateAction);

  const form = useForm<BirthFetalHeartRateInput>({
    resolver: zodResolver(birthFetalHeartRateSchema),
    defaultValues: { bpm: 125, ...defaultBirthEventDateTime() },
  });

  useEffect(() => {
    if (open) form.reset({ bpm: 125, ...defaultBirthEventDateTime() });
  }, [open, form]);

  async function onSubmit(values: BirthFetalHeartRateInput) {
    const result = await addHeartRate({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("BCF registrada!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou a BCF há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Frequência Cardíaca Fetal"
      description="Informe a BCF em batimentos por minuto"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="bpm"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2 pb-3">
                  <FormLabel className="whitespace-nowrap">BCF (bpm) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={250}
                      className="text-right"
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === "" ? undefined : Number(event.target.value),
                        )
                      }
                    />
                  </FormControl>
                </div>
                <Slider
                  min={0}
                  max={250}
                  step={1}
                  value={[field.value ?? 125]}
                  onValueChange={([value]) => field.onChange(value)}
                />
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>0 bpm</span>
                  <span>250 bpm</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

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
