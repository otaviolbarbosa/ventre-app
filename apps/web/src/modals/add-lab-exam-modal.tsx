"use client";

import { addLabExamAction } from "@/actions/add-lab-exam-action";
import { updateLabExamAction } from "@/actions/update-lab-exam-action";
import { type LabExamInput, labExamSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const PRENATAL_EXAM_CATEGORIES_AND_NAMES = {
  Hematologia: [
    "Hemoglobina",
    "Hematócrito",
    "Leucograma",
    "Plaquetas",
    "MCV",
    "Coagulograma",
    "Eletroforese de Hemoglobina HbA1",
    "Eletroforese de Hemoglobina HbA2",
    "Eletroforese de Hemoglobina HbF",
    "Eletroforese de Hemoglobina HbS",
    "Eletroforese de Hemoglobina HbC",
  ],
  "Tipagem sanguínea": ["Tipagem Sanguínea e Fator Rh (ABO-Rh)", "Coombs Indireto"],
  "Metabolismo da glicose": ["Glicemia de Jejum", "TOTG 75g", "Insulina"],
  "Sorologias infecciosas": [
    "Sífilis (teste rápido)",
    "VDRL",
    "HIV (Anti-HIV)",
    "Hepatite B (HBsAg)",
    "Hepatite C (Anti-HCV)",
    "Toxoplasmose",
    "Rubéola",
    "Citomegalovírus (CMV)",
    "HTLV 1 e 2",
  ],
  "Função tireoidiana": ["TSH/T4L"],
  "Nutrientes e vitaminas": ["Ferro Sérico", "Ferritina", "Vitamina D", "Vitamina B12"],
  Urina: ["Urina Tipo I (EAS)", "Urocultura", "Proteinúria (24h)"],
  "Bioquímica hepática/renal": [
    "Bilirrubinas (Total, Direta e Indireta)",
    "TGO/TGP",
    "Desidrogenase Lática (DHL)",
    "Ureia/Creatinina (UR/CR)",
    "Ácido Úrico",
    "Lipidograma",
  ],
  "Rastreio ginecológico/microbiológico": [
    "Cultura para Streptococcus do Grupo B (EGB)",
    "Colpocitologia Oncótica (CCO)",
  ],
  "Não categorizados": ["Outros"],
};

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
                      onChange={(date) =>
                        field.onChange(date ? date.toISOString().slice(0, 10) : "")
                      }
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
                      {Object.entries(PRENATAL_EXAM_CATEGORIES_AND_NAMES).map(([group, names]) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {names.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
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
