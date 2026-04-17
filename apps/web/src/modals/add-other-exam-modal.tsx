"use client";

import { addOtherExamAction } from "@/actions/add-other-exam-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { type OtherExamInput, otherExamSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddOtherExamModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddOtherExamModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddOtherExamModalProps) {
  const { executeAsync, isPending } = useAction(addOtherExamAction);

  const form = useForm<OtherExamInput>({
    resolver: zodResolver(otherExamSchema),
    defaultValues: { exam_date: new Date().toISOString().split("T")[0], description: "" },
  });

  async function onSubmit(values: OtherExamInput) {
    const result = await executeAsync({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Exame registrado!");
    form.reset({ exam_date: new Date().toISOString().split("T")[0], description: "" });
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Novo Exame"
      description="Registre exames como CTG, NST e outros"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="exam_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data do exame *</FormLabel>
                <FormControl>
                  <DatePicker
                    selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                    onChange={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
                    placeholderText="Selecione a data"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição / Resultado *</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Ex: CTG reativo, traçado com acelerações..."
                    {...field}
                  />
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
