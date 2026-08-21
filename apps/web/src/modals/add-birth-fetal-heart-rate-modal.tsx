"use client";

import { addBirthFetalHeartRateAction } from "@/actions/add-birth-fetal-heart-rate-action";
import {
  type BirthFetalHeartRateInput,
  birthFetalHeartRateSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
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
    defaultValues: { bpm: undefined },
  });

  useEffect(() => {
    if (open) form.reset({ bpm: undefined });
  }, [open, form]);

  async function onSubmit(values: BirthFetalHeartRateInput) {
    const result = await addHeartRate({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("FCF registrada!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou a FCF há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Frequência Cardíaca Fetal"
      description="Informe a FCF em batimentos por minuto"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="bpm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FCF: {field.value ?? 140} bpm *</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={250}
                    step={1}
                    value={[field.value ?? 140]}
                    onValueChange={([value]) => field.onChange(value)}
                  />
                </FormControl>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>0 bpm</span>
                  <span>250 bpm</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

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
