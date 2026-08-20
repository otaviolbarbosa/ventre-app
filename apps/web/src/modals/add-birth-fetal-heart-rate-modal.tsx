"use client";

import { addBirthFetalHeartRateAction } from "@/actions/add-birth-fetal-heart-rate-action";
import {
  type BirthFetalHeartRateInput,
  birthFetalHeartRateSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
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
                <FormLabel>FCF (bpm) *</FormLabel>
                <FormControl>
                  <Input type="number" min="1" max="299" {...field} value={field.value ?? ""} />
                </FormControl>
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
