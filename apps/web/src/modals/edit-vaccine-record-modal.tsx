"use client";

import { upsertVaccineRecordAction } from "@/actions/upsert-vaccine-record-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { VACCINE_LABELS } from "@/lib/prenatal-constants";
import { type VaccineRecordInput, vaccineRecordSchema } from "@/lib/validations/prenatal";
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

type EditVaccineRecordModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  vaccineName: string;
  record?: Tables<"vaccine_records">;
  onSuccess: () => void;
};

export function EditVaccineRecordModal({
  open,
  onOpenChange,
  pregnancyId,
  vaccineName,
  record,
  onSuccess,
}: EditVaccineRecordModalProps) {
  const { executeAsync, isPending } = useAction(upsertVaccineRecordAction);

  const form = useForm<VaccineRecordInput>({
    resolver: zodResolver(vaccineRecordSchema),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open
  useEffect(() => {
    if (open) {
      form.reset({
        vaccine_name: vaccineName as VaccineRecordInput["vaccine_name"],
        dose_number: record?.dose_number ?? undefined,
        applied_date: record?.applied_date ?? "",
        status: (record?.status as VaccineRecordInput["status"]) ?? undefined,
        notes: record?.notes ?? "",
      });
    }
  }, [open, vaccineName, record]);

  async function onSubmit(values: VaccineRecordInput) {
    const result = await executeAsync({
      pregnancyId,
      recordId: record?.id,
      data: values,
    });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Vacina atualizada!");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title={VACCINE_LABELS[vaccineName] ?? vaccineName}
      description="Registre os dados da vacinação"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="applied">Aplicada</SelectItem>
                      <SelectItem value="immunized">Imune</SelectItem>
                      <SelectItem value="not_applicable">Não aplicada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dose_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dose</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={field.value?.toString() ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1ª dose</SelectItem>
                      <SelectItem value="2">2ª dose</SelectItem>
                      <SelectItem value="3">3ª dose</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="applied_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de aplicação</FormLabel>
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
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
