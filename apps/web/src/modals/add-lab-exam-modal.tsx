"use client";

import { addLabExamAction } from "@/actions/add-lab-exam-action";
import { updateLabExamAction } from "@/actions/update-lab-exam-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { HEMOGLOBIN_LABELS } from "@/lib/prenatal-constants";
import { type LabExamInput, labExamSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const PRENATAL_EXAM_NAMES = [
  "ABO-RH",
  "Hemoglobina/Hematócrito",
  "Plaquetas",
  "Glicemia de Jejum",
  "TOTG",
  "Sífilis",
  "VDRL",
  "HIV/Anti HIV",
  "Hepatite B (HBsAg)",
  "Hepatite C",
  "Toxoplasmose",
  "Rubéola",
  "Coombs Indireto",
  "CMV",
  "Ferritina",
  "TSH/T4L",
  "HTLV1e2",
  "Vitamina D",
  "Urina-EAS",
  "Urocultura",
  "Eletroforese de Hemoglobina",
  "Outro",
];

type AddLabExamModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  exam?: Tables<"lab_exam_results">;
  onSuccess: () => void;
};

export function AddLabExamModal({
  open,
  onOpenChange,
  pregnancyId,
  exam,
  onSuccess,
}: AddLabExamModalProps) {
  const isEditing = !!exam;

  const { executeAsync: addExam, isPending: isAdding } = useAction(addLabExamAction);
  const { executeAsync: updateExam, isPending: isUpdating } = useAction(updateLabExamAction);
  const isPending = isAdding || isUpdating;

  const form = useForm<LabExamInput>({
    resolver: zodResolver(labExamSchema),
    defaultValues: { exam_date: new Date().toISOString().split("T")[0] },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (open) {
      form.reset({
        exam_date: exam?.exam_date ?? new Date().toISOString().split("T")[0],
        exam_name: exam?.exam_name ?? undefined,
        result_text: exam?.result_text ?? "",
        result_numeric: exam?.result_numeric ?? undefined,
        unit: exam?.unit ?? "",
        hemoglobin_electrophoresis:
          (exam?.hemoglobin_electrophoresis as LabExamInput["hemoglobin_electrophoresis"]) ??
          undefined,
      });
    }
  }, [open, exam]);

  async function onSubmit(values: LabExamInput) {
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
      title={isEditing ? "Editar Exame Laboratorial" : "Novo Exame Laboratorial"}
      description="Registre o resultado do exame"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              name="exam_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do exame *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRENATAL_EXAM_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="result_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado (texto)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Negativo, Imune..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="result_numeric"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado (número)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: mg/dL" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="hemoglobin_electrophoresis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Eletroforese de Hemoglobina</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(HEMOGLOBIN_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
