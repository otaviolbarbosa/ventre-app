"use client";

import { addPregnancyEvolutionAction } from "@/actions/add-pregnancy-evolution-action";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { type PregnancyEvolutionInput, pregnancyEvolutionSchema } from "@/lib/validations/prenatal";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AddPregnancyEvolutionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddPregnancyEvolutionModal({
  open,
  onOpenChange,
  pregnancyId,
  onSuccess,
}: AddPregnancyEvolutionModalProps) {
  const { executeAsync, isPending } = useAction(addPregnancyEvolutionAction);

  const form = useForm<PregnancyEvolutionInput>({
    resolver: zodResolver(pregnancyEvolutionSchema),
    defaultValues: { consultation_date: new Date().toISOString().split("T")[0] },
  });

  async function onSubmit(values: PregnancyEvolutionInput) {
    const result = await executeAsync({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Evolução registrada com sucesso!");
    form.reset({ consultation_date: new Date().toISOString().split("T")[0] });
    onOpenChange(false);
    onSuccess();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Evolução"
      description="Registre dados da consulta pré-natal"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Linha 1: Data da consulta (2 cols) | Apresentação fetal (2 cols) */}
          <div className="grid grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="consultation_date"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Data da consulta *</FormLabel>
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
              name="fetal_presentation"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Apresentação fetal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cephalic">Cefálica</SelectItem>
                      <SelectItem value="pelvic">Pélvica</SelectItem>
                      <SelectItem value="transverse">Transversa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Linha 2: IG semanas (1 col) | Dias (1 col) | Fonte da IG (2 cols) */}
          <div className="grid grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="gestational_weeks"
              render={({ field }) => (
                <FormItem className="col-span-1">
                  <FormLabel>IG semanas</FormLabel>
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
                <FormItem className="col-span-1">
                  <FormLabel>Dias</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max="6" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ig_source"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Fonte da IG</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="dum">DUM</SelectItem>
                      <SelectItem value="usg">USG</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Linha 3: Peso (2 cols) | AU (2 cols) */}
          <div className="grid grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="weight_kg"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Peso (kg)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="uterine_height_cm"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>AU (cm)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Linha 4: PA sistólica (2 cols) | PA diastólica (2 cols) */}
          <div className="grid grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="systolic_bp"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>PA sistólica</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diastolic_bp"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>PA diastólica</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Linha 5: BCF (2 cols) | MF presente + Edema (2 cols) */}
          <div className="grid grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="fetal_heart_rate"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>BCF (bpm)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-2 flex items-end gap-4 pb-1">
              <FormField
                control={form.control}
                name="fetal_movement"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">MF presente</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="edema"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Edema</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="complaint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Queixa principal</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cervical_exam"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exame de colo</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conduta / Observações</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="responsible"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profissional responsável</FormLabel>
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
