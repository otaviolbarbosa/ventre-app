"use client";

import { addUltrasoundAction } from "@/actions/add-ultrasound-action";
import { updateUltrasoundAction } from "@/actions/update-ultrasound-action";
import { AMNIOTIC_FLUID_INDEX_LABELS } from "@/lib/prenatal-constants";
import { type UltrasoundInput, ultrasoundSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddUltrasoundModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  ultrasound?: Tables<"ultrasounds">;
  onSuccess: () => void;
};

export function AddUltrasoundModal({
  open,
  onOpenChange,
  pregnancyId,
  ultrasound,
  onSuccess,
}: AddUltrasoundModalProps) {
  const isEditing = !!ultrasound;
  const { executeAsync: addUltrasound, isPending: isAdding } = useAction(addUltrasoundAction);
  const { executeAsync: updateUltrasound, isPending: isUpdating } =
    useAction(updateUltrasoundAction);
  const isPending = isAdding || isUpdating;

  const form = useForm<UltrasoundInput>({
    resolver: zodResolver(ultrasoundSchema),
    defaultValues: { exam_date: new Date().toISOString().split("T")[0] },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        exam_date: ultrasound?.exam_date ?? new Date().toISOString().split("T")[0],
        gestational_weeks: ultrasound?.gestational_weeks ?? undefined,
        gestational_days: ultrasound?.gestational_days ?? undefined,
        ccn_mm: ultrasound?.ccn_mm ?? undefined,
        fetal_heart_rate_bpm: ultrasound?.fetal_heart_rate_bpm ?? undefined,
        nuchal_translucency_mm: ultrasound?.nuchal_translucency_mm ?? undefined,
        cervical_length_cm: ultrasound?.cervical_length_cm ?? undefined,
        estimated_weight_g: ultrasound?.estimated_weight_g ?? undefined,
        amniotic_fluid_index: ultrasound?.amniotic_fluid_index ?? undefined,
        placenta_position: ultrasound?.placenta_position ?? undefined,
        doppler_result: ultrasound?.doppler_result ?? undefined,
        nasal_bone_present: ultrasound?.nasal_bone_present ?? undefined,
        iugr: ultrasound?.iugr ?? undefined,
        notes: ultrasound?.notes ?? undefined,
      });
    }
  }, [open, ultrasound, form]);

  async function onSubmit(values: UltrasoundInput) {
    if (isEditing) {
      const result = await updateUltrasound({ ultrasoundId: ultrasound.id, data: values });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success("Ultrassonografia atualizada!");
    } else {
      const result = await addUltrasound({ pregnancyId, data: values });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success("Ultrassonografia registrada!");
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Ultrassonografia" : "Nova Ultrassonografia"}
      description="Registre os dados do exame de imagem"
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
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="gestational_weeks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IG sem.</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="45" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gestational_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dias</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="6" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["ccn_mm", "CCN (mm)"],
                ["fetal_heart_rate_bpm", "FCF (bpm)"],
                ["nuchal_translucency_mm", "TN (mm)"],
                ["cervical_length_cm", "Colo (cm)"],
                ["estimated_weight_g", "Peso est. (g)"],
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
                      <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <FormField
            control={form.control}
            name="amniotic_fluid_index"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ILA (Índice de Líquido Amniótico)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(AMNIOTIC_FLUID_INDEX_LABELS).map(([value, label]) => (
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="placenta_position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Posição da placenta</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: fúndica, anterior..."
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
              name="doppler_result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doppler</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="abnormal">Alterado</SelectItem>
                      <SelectItem value="not_performed">Não realizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-4">
            <FormField
              control={form.control}
              name="nasal_bone_present"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Osso nasal presente</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="iugr"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">CIUR</FormLabel>
                </FormItem>
              )}
            />
          </div>

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
              {isEditing ? "Salvar alterações" : "Salvar"}
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
