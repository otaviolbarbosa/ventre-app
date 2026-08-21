"use client";

import { addBirthMedicationAdministrationAction } from "@/actions/add-birth-medication-administration-action";
import { BIRTH_MEDICATION_TYPE_LABELS } from "@/lib/birth-mode-constants";
import {
  type BirthMedicationAdministrationInput,
  birthMedicationAdministrationSchema,
} from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddBirthMedicationAdministrationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthMedicationAdministrationModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddBirthMedicationAdministrationModalProps) {
  const { executeAsync: addMedication, isPending } = useAction(
    addBirthMedicationAdministrationAction,
  );

  const form = useForm<BirthMedicationAdministrationInput>({
    resolver: zodResolver(birthMedicationAdministrationSchema),
    defaultValues: {
      medication_type: undefined,
      other_birth_medication_type: undefined,
      notes: undefined,
    },
  });

  const medicationType = form.watch("medication_type");

  useEffect(() => {
    if (open) {
      form.reset({
        medication_type: undefined,
        other_birth_medication_type: undefined,
        notes: undefined,
      });
    }
  }, [open, form]);

  async function onSubmit(values: BirthMedicationAdministrationInput) {
    const result = await addMedication({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Medicamento registrado!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou um medicamento há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Administração de Medicamento"
      description="Selecione o tipo de medicamento administrado"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="medication_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(BIRTH_MEDICATION_TYPE_LABELS).map(([value, label]) => (
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

          {medicationType === "outros" && (
            <FormField
              control={form.control}
              name="other_birth_medication_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qual medicamento? *</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
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
