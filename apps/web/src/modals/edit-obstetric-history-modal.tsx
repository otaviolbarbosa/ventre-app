"use client";

import { upsertObstetricHistoryAction } from "@/actions/upsert-obstetric-history-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { CLINICAL_FIELDS, SURGICAL_FIELDS } from "@/lib/prenatal-constants";
import { type ObstetricHistoryInput, obstetricHistorySchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Separator } from "@ventre/ui/separator";
type PregnancyCounts = Pick<
  Tables<"pregnancies">,
  "gestations_count" | "deliveries_count" | "cesareans_count" | "abortions_count"
> | null;
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type EditObstetricHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  pregnancyId: string;
  history: Tables<"patient_obstetric_history"> | null;
  pregnancyCounts: PregnancyCounts;
  onSuccess: () => void;
};

export function EditObstetricHistoryModal({
  open,
  onOpenChange,
  patientId,
  pregnancyId,
  history,
  pregnancyCounts,
  onSuccess,
}: EditObstetricHistoryModalProps) {
  const { executeAsync, isPending } = useAction(upsertObstetricHistoryAction);

  const form = useForm<ObstetricHistoryInput>({
    resolver: zodResolver(obstetricHistorySchema),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (open) {
      form.reset({
        gestations_count: pregnancyCounts?.gestations_count ?? undefined,
        deliveries_count: pregnancyCounts?.deliveries_count ?? undefined,
        cesareans_count: pregnancyCounts?.cesareans_count ?? undefined,
        abortions_count: pregnancyCounts?.abortions_count ?? undefined,
        diabetes: history?.diabetes ?? false,
        urinary_infection: history?.urinary_infection ?? false,
        infertility: history?.infertility ?? false,
        breastfeeding_difficulty: history?.breastfeeding_difficulty ?? false,
        cardiopathy: history?.cardiopathy ?? false,
        thromboembolism: history?.thromboembolism ?? false,
        hypertension: history?.hypertension ?? false,
        other_clinical: history?.other_clinical ?? false,
        other_clinical_notes: history?.other_clinical_notes ?? "",
        pelvic_uterine_surgery: history?.pelvic_uterine_surgery ?? false,
        prior_surgery: history?.prior_surgery ?? false,
        other_surgery_notes: history?.other_surgery_notes ?? "",
      });
    }
  }, [open, history, pregnancyCounts]);

  async function onSubmit(values: ObstetricHistoryInput) {
    const result = await executeAsync({ patientId, pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Antecedentes atualizados!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Antecedentes Obstétricos"
      description="Registre os antecedentes clínicos e cirúrgicos"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          <Separator />

          <p className="font-medium text-sm">Antecedentes clínicos</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLINICAL_FIELDS.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name as keyof ObstetricHistoryInput}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={(field.value as boolean) ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{f.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="other_clinical_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição dos outros clínicos</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <p className="font-medium text-sm">Antecedentes cirúrgicos</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SURGICAL_FIELDS.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name as keyof ObstetricHistoryInput}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={(field.value as boolean) ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{f.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="other_surgery_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição das outras cirurgias</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
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
