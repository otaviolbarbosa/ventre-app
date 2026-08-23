"use client";

import { activateBirthModeAction } from "@/actions/activate-birth-mode-action";
import {
  BIRTH_MODE_INDUCTION_TYPE_LABELS,
  BIRTH_MODE_LABOUR_TYPE_LABELS,
} from "@/lib/birth-mode-constants";
import { type ActivateBirthModeInput, activateBirthModeSchema } from "@/lib/validations/birth-mode";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type StartLabourModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
};

export function StartLabourModal({ open, onOpenChange, pregnancyId }: StartLabourModalProps) {
  const router = useRouter();
  const { executeAsync: activateBirthMode, isPending } = useAction(activateBirthModeAction);

  const form = useForm<ActivateBirthModeInput>({
    resolver: zodResolver(activateBirthModeSchema),
    defaultValues: {
      pregnancyId,
      birth_mode_labour_type: undefined,
      birth_mode_induction_type: undefined,
      labour_start_description: undefined,
    },
  });

  const labourType = form.watch("birth_mode_labour_type");

  useEffect(() => {
    if (open) {
      form.reset({
        pregnancyId,
        birth_mode_labour_type: undefined,
        birth_mode_induction_type: undefined,
        labour_start_description: undefined,
      });
    }
  }, [open, pregnancyId, form]);

  async function onSubmit(values: ActivateBirthModeInput) {
    const result = await activateBirthMode(values);
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Modo Parto ativado!");
    onOpenChange(false);
    router.push(`/modo-parto?pregnancyId=${pregnancyId}`);
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Ativar Modo Parto"
      description="Registre os dados do início do trabalho de parto. Isso enviará uma notificação por WhatsApp para toda a equipe de cuidado."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="birth_mode_labour_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de trabalho de parto *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(BIRTH_MODE_LABOUR_TYPE_LABELS).map(([value, label]) => (
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

          {labourType === "induzido" && (
            <FormField
              control={form.control}
              name="birth_mode_induction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de indução *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(BIRTH_MODE_INDUCTION_TYPE_LABELS).map(([value, label]) => (
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
          )}

          <FormField
            control={form.control}
            name="labour_start_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
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
              Ativar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
