"use client";

import { finishPatientCareAction } from "@/actions/finish-patient-care-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  addBornAt: z.boolean().default(false),
  bornAt: z.string().optional(),
  deliveryMethod: z.enum(["cesarean", "vaginal"]).optional(),
  description: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface FinishCareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess: () => void;
}

export function FinishCareModal({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: FinishCareModalProps) {
  const router = useRouter();
  const { executeAsync, isPending } = useAction(finishPatientCareAction);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      addBornAt: false,
      bornAt: "",
      deliveryMethod: undefined,
      description: "",
    },
  });

  const addBornAt = form.watch("addBornAt");

  async function onSubmit(values: FormValues) {
    const res = await executeAsync({
      patientId,
      bornAt: values.addBornAt && values.bornAt ? values.bornAt : undefined,
      deliveryMethod: values.addBornAt ? values.deliveryMethod : undefined,
      description: values.description || undefined,
    });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    toast.success("Acompanhamento finalizado com sucesso!");
    form.reset();
    onOpenChange(false);
    onSuccess();
    router.push("/patients");
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Finalizar Acompanhamento"
      description="Registre o encerramento do acompanhamento desta gestante."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="addBornAt"
              render={({ field }) => (
                <label htmlFor="addBornAt" className="flex cursor-pointer items-center gap-2">
                  <input
                    id="addBornAt"
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      if (!e.target.checked) {
                        form.setValue("bornAt", "");
                        form.setValue("deliveryMethod", undefined);
                      }
                    }}
                    className="size-4 rounded border-input accent-primary"
                  />
                  <span className="font-medium text-sm leading-none">
                    Adicionar data de nascimento
                  </span>
                </label>
              )}
            />

            {addBornAt && (
              <>
                <FormField
                  control={form.control}
                  name="bornAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deliveryMethod"
                  render={({ field }) => (
                    <FormItem className="mt-3 space-y-2">
                      <FormLabel>Via de parto</FormLabel>
                      <FormControl>
                        <div className="flex gap-4">
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              value="vaginal"
                              checked={field.value === "vaginal"}
                              onChange={() => field.onChange("vaginal")}
                              className="accent-primary"
                            />
                            Parto normal
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              value="cesarean"
                              checked={field.value === "cesarean"}
                              onChange={() => field.onChange("cesarean")}
                              className="accent-primary"
                            />
                            Cesárea
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Textarea placeholder="Descreva como foi o acompanhamento..." rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
