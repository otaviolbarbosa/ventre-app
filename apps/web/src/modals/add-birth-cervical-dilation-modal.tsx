"use client";

import { addBirthCervicalDilationAction } from "@/actions/add-birth-cervical-dilation-action";
import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
import { dayjs } from "@/lib/dayjs";
import {
  type BirthCervicalDilationInput,
  birthCervicalDilationSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Slider } from "@ventre/ui/slider";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddBirthCervicalDilationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthCervicalDilationModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthCervicalDilationModalProps) {
  const { executeAsync: addDilation, isPending } = useAction(addBirthCervicalDilationAction);

  const form = useForm<BirthCervicalDilationInput>({
    resolver: zodResolver(birthCervicalDilationSchema),
    defaultValues: { dilation_cm: undefined, ...defaultBirthEventDateTime() },
  });

  useEffect(() => {
    if (open) form.reset({ dilation_cm: undefined, ...defaultBirthEventDateTime() });
  }, [open, form]);

  async function onSubmit(values: BirthCervicalDilationInput) {
    const result = await addDilation({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Dilatação registrada!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou uma dilatação há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Dilatação Cervical"
      description="Informe a dilatação em centímetros (0 a 10)"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="dilation_cm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dilatação: {field.value ? field.value.toFixed(1) : 0} cm *</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={10}
                    step={0.5}
                    value={[field.value ?? 0]}
                    onValueChange={([value]) => field.onChange(value)}
                  />
                </FormControl>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>0 cm</span>
                  <span>10 cm</span>
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
