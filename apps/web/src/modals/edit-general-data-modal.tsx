"use client";

import { upsertPatientPrenatalFieldsAction } from "@/actions/upsert-patient-prenatal-fields-action";
import { ContentModal } from "@/components/shared/content-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type UpdatePatientPrenatalInput,
  updatePatientPrenatalSchema,
} from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

type PatientData = Pick<
  Tables<"patients">,
  | "blood_type"
  | "height_cm"
  | "allergies"
  | "personal_notes"
  | "family_history_diabetes"
  | "family_history_hypertension"
  | "family_history_twin"
  | "family_history_others"
> | null;

type PregnancyData = Pick<
  Tables<"pregnancies">,
  | "gestations_count"
  | "deliveries_count"
  | "cesareans_count"
  | "abortions_count"
  | "initial_weight_kg"
  | "initial_bmi"
> | null;

type EditGeneralDataModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  pregnancyId: string;
  patientData: PatientData;
  pregnancyData: PregnancyData;
  onSuccess: () => void;
};

export function EditGeneralDataModal({
  open,
  onOpenChange,
  patientId,
  pregnancyId,
  patientData,
  pregnancyData,
  onSuccess,
}: EditGeneralDataModalProps) {
  const { executeAsync, isPending } = useAction(upsertPatientPrenatalFieldsAction);

  const form = useForm<UpdatePatientPrenatalInput>({
    resolver: zodResolver(updatePatientPrenatalSchema),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (open) {
      form.reset({
        blood_type: patientData?.blood_type ?? undefined,
        height_cm: patientData?.height_cm ?? undefined,
        allergies: patientData?.allergies?.join(", ") ?? "",
        personal_notes: patientData?.personal_notes ?? "",
        family_history_diabetes: patientData?.family_history_diabetes ?? false,
        family_history_hypertension: patientData?.family_history_hypertension ?? false,
        family_history_twin: patientData?.family_history_twin ?? false,
        family_history_others: patientData?.family_history_others ?? "",
        gestations_count: pregnancyData?.gestations_count ?? undefined,
        deliveries_count: pregnancyData?.deliveries_count ?? undefined,
        cesareans_count: pregnancyData?.cesareans_count ?? undefined,
        abortions_count: pregnancyData?.abortions_count ?? undefined,
        initial_weight_kg: pregnancyData?.initial_weight_kg ?? undefined,
      });
    }
  }, [open, patientData, pregnancyData]);

  async function onSubmit(values: UpdatePatientPrenatalInput) {
    const result = await executeAsync({ patientId, pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Dados atualizados com sucesso!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Dados Gerais"
      description="Atualize os dados gerais da gestante"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="blood_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo sanguíneo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BLOOD_TYPES.map((bt) => (
                        <SelectItem key={bt} value={bt}>
                          {bt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="height_cm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Altura (cm)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="initial_weight_kg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso inicial (kg)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="allergies"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alergias (separadas por vírgula)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Penicilina, Dipirona"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="font-medium text-sm">Histórico obstétrico</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["gestations_count", "Nº de gestações"],
                ["deliveries_count", "Nº de partos"],
                ["cesareans_count", "Nº de cesáreas"],
                ["abortions_count", "Nº de abortos"],
              ] as const
            ).map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <p className="font-medium text-sm">Histórico familiar</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["family_history_diabetes", "Diabetes"],
                ["family_history_hypertension", "Hipertensão"],
                ["family_history_twin", "Gemelar"],
              ] as const
            ).map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>

          <FormField
            control={form.control}
            name="family_history_others"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outros antecedentes familiares</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="personal_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações pessoais</FormLabel>
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
