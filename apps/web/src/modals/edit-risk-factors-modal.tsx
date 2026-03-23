"use client";

import { upsertRiskFactorsAction } from "@/actions/upsert-risk-factors-action";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RISK_GROUPS } from "@/lib/prenatal-constants";
import { type RiskFactorsInput, riskFactorsSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type EditRiskFactorsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  riskFactors: Tables<"pregnancy_risk_factors"> | null;
  onSuccess: () => void;
};

export function EditRiskFactorsModal({
  open,
  onOpenChange,
  pregnancyId,
  riskFactors,
  onSuccess,
}: EditRiskFactorsModalProps) {
  const { executeAsync, isPending } = useAction(upsertRiskFactorsAction);

  const form = useForm<RiskFactorsInput>({
    resolver: zodResolver(riskFactorsSchema),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (open) {
      form.reset({
        smoking: riskFactors?.smoking ?? false,
        cigarettes_per_day: riskFactors?.cigarettes_per_day ?? undefined,
        alcohol: riskFactors?.alcohol ?? false,
        other_drugs: riskFactors?.other_drugs ?? false,
        domestic_violence: riskFactors?.domestic_violence ?? false,
        hiv_aids: riskFactors?.hiv_aids ?? false,
        syphilis: riskFactors?.syphilis ?? false,
        toxoplasmosis: riskFactors?.toxoplasmosis ?? false,
        urinary_infection: riskFactors?.urinary_infection ?? false,
        fever: riskFactors?.fever ?? false,
        anemia: riskFactors?.anemia ?? false,
        isthmocervical_incompetence: riskFactors?.isthmocervical_incompetence ?? false,
        preterm_labor_threat: riskFactors?.preterm_labor_threat ?? false,
        rh_isoimmunization: riskFactors?.rh_isoimmunization ?? false,
        oligo_polyhydramnios: riskFactors?.oligo_polyhydramnios ?? false,
        premature_membrane_rupture: riskFactors?.premature_membrane_rupture ?? false,
        iugr: riskFactors?.iugr ?? false,
        post_term: riskFactors?.post_term ?? false,
        hypertension: riskFactors?.hypertension ?? false,
        preeclampsia_eclampsia: riskFactors?.preeclampsia_eclampsia ?? false,
        cardiopathy: riskFactors?.cardiopathy ?? false,
        gestational_diabetes: riskFactors?.gestational_diabetes ?? false,
        insulin_use: riskFactors?.insulin_use ?? false,
        hemorrhage_1st_trimester: riskFactors?.hemorrhage_1st_trimester ?? false,
        hemorrhage_2nd_trimester: riskFactors?.hemorrhage_2nd_trimester ?? false,
        hemorrhage_3rd_trimester: riskFactors?.hemorrhage_3rd_trimester ?? false,
        exantema: riskFactors?.exantema ?? false,
        other_notes: riskFactors?.other_notes ?? "",
      });
    }
  }, [open, riskFactors]);

  async function onSubmit(values: RiskFactorsInput) {
    const result = await executeAsync({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Fatores de risco atualizados!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Fatores de Risco da Gestação"
      description="Registre os fatores de risco identificados"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {RISK_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 font-medium text-sm">{group.label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.fields.map((f) => (
                  <FormField
                    key={f.name}
                    control={form.control}
                    name={f.name as keyof RiskFactorsInput}
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
              <Separator className="mt-3" />
            </div>
          ))}

          <FormField
            control={form.control}
            name="cigarettes_per_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cigarros por dia</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="other_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outras observações</FormLabel>
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
