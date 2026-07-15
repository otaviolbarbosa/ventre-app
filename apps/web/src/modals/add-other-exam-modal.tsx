"use client";

import { addOtherExamAction } from "@/actions/add-other-exam-action";
import { updateOtherExamAction } from "@/actions/update-other-exam-action";
import { type OtherExamInput, otherExamSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddOtherExamModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  exam?: Tables<"other_exams">;
  onSuccess: () => void;
};

export function AddOtherExamModal({
  open,
  onOpenChange,
  pregnancyId,
  exam,
  onSuccess,
}: AddOtherExamModalProps) {
  const isEditing = !!exam;
  const { executeAsync: addExam, isPending: isAdding } = useAction(addOtherExamAction);
  const { executeAsync: updateExam, isPending: isUpdating } = useAction(updateOtherExamAction);
  const isPending = isAdding || isUpdating;

  const form = useForm<OtherExamInput>({
    resolver: zodResolver(otherExamSchema),
    defaultValues: { exam_date: new Date().toISOString().split("T")[0], description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        exam_date: exam?.exam_date ?? new Date().toISOString().split("T")[0],
        description: exam?.description ?? "",
      });
    }
  }, [open, exam, form]);

  async function onSubmit(values: OtherExamInput) {
    if (isEditing) {
      const result = await updateExam({ examId: exam.id, data: values });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success("Exame atualizado!");
    } else {
      const result = await addExam({ pregnancyId, data: values });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success("Exame registrado!");
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Exame" : "Novo Exame"}
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
              {isEditing ? "Salvar alterações" : "Salvar"}
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
