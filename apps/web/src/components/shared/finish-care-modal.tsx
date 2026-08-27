"use client";

import { finishPatientCareAction } from "@/actions/finish-patient-care-action";
import { BABY_SEX_LABELS } from "@/lib/constants";
import { dayjs } from "@/lib/dayjs";
import { type BirthOutcomeInput, birthOutcomeSchema } from "@/lib/validations/birth-outcome";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { TimePicker } from "@ventre/ui/shared/time-picker";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const APGAR_COMPONENTS = [
  { key: "appearance", label: "Aparência (cor da pele)" },
  { key: "pulse", label: "Pulso (frequência cardíaca)" },
  { key: "grimace", label: "Irritabilidade reflexa" },
  { key: "activity", label: "Tônus muscular" },
  { key: "respiration", label: "Respiração" },
] as const;

interface FinishCareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  pregnancyId?: string;
  onSuccess: () => void;
}

export function FinishCareModal({
  open,
  onOpenChange,
  patientId,
  pregnancyId,
  onSuccess,
}: FinishCareModalProps) {
  const router = useRouter();
  const { executeAsync, isPending } = useAction(finishPatientCareAction);

  const form = useForm<BirthOutcomeInput>({
    resolver: zodResolver(birthOutcomeSchema),
    defaultValues: {
      addBornAt: false,
      bornAt: "",
      bornAtTime: "",
      deliveryMethod: undefined,
      babySex: undefined,
      birthWeightGrams: undefined,
      addApgar: false,
      apgar1: {},
      apgar5: {},
      description: "",
    },
  });

  const addBornAt = form.watch("addBornAt");
  const addApgar = form.watch("addApgar");
  const apgar1Values = form.watch("apgar1");
  const apgar5Values = form.watch("apgar5");

  function sumApgar(values: {
    appearance?: number;
    pulse?: number;
    grimace?: number;
    activity?: number;
    respiration?: number;
  }) {
    return APGAR_COMPONENTS.reduce((sum, { key }) => sum + (values[key] ?? 0), 0);
  }

  const apgar1Total = sumApgar(apgar1Values);
  const apgar5Total = sumApgar(apgar5Values);

  async function onSubmit(values: BirthOutcomeInput) {
    const res = await executeAsync({
      ...values,
      patientId,
      pregnancyId,
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
                        form.setValue("bornAtTime", "");
                        form.setValue("deliveryMethod", undefined);
                        form.setValue("babySex", undefined);
                        form.setValue("birthWeightGrams", undefined);
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
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="bornAt"
                    render={({ field }) => (
                      <FormItem className="flex-1">
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
                    name="bornAtTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <TimePicker
                            selected={
                              field.value
                                ? new Date(`1970-01-01T${field.value}:00`)
                                : null
                            }
                            onChange={(date) =>
                              field.onChange(date ? dayjs(date).format("HH:mm") : "")
                            }
                            minTime={new Date(new Date().setHours(0, 0, 0, 0))}
                            maxTime={new Date(new Date().setHours(23, 55, 0, 0))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="deliveryMethod"
                  render={({ field }) => (
                    <FormItem className="mt-3 space-y-2">
                      <FormLabel>Via de parto</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-4">
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
                              value="vaginal_assisted"
                              checked={field.value === "vaginal_assisted"}
                              onChange={() => field.onChange("vaginal_assisted")}
                              className="accent-primary"
                            />
                            Parto normal assistido
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

                <div className="mt-3 flex gap-2">
                  <FormField
                    control={form.control}
                    name="babySex"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Sexo do bebê</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(BABY_SEX_LABELS).map(([value, label]) => (
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

                  <FormField
                    control={form.control}
                    name="birthWeightGrams"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Peso ao nascer (g)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder="Ex: 3200"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value.replace(/\D/g, ""))
                            }
                            onKeyDown={(e) => {
                              if (["e", "E", "+", "-", "."].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <FormField
                    control={form.control}
                    name="addApgar"
                    render={({ field }) => (
                      <label
                        htmlFor="addApgar"
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          id="addApgar"
                          type="checkbox"
                          checked={field.value}
                          disabled={!pregnancyId}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4 rounded border-input accent-primary disabled:opacity-50"
                        />
                        <span className="font-medium text-sm leading-none">Registrar APGAR</span>
                      </label>
                    )}
                  />
                  {!pregnancyId && (
                    <p className="text-muted-foreground text-xs">
                      Não é possível registrar o APGAR sem uma gestação associada.
                    </p>
                  )}

                  {addApgar && pregnancyId && (
                    <>
                      <div className="grid grid-cols-2 gap-4 rounded-md border border-input p-3">
                        {(["apgar1", "apgar5"] as const).map((timepoint) => (
                          <div key={timepoint} className="space-y-2">
                            <p className="font-medium text-sm">
                              {timepoint === "apgar1" ? "1 minuto" : "5 minutos"}
                            </p>
                            {APGAR_COMPONENTS.map(({ key, label }) => (
                              <FormField
                                key={key}
                                control={form.control}
                                name={`${timepoint}.${key}`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="font-normal text-xs">{label}</FormLabel>
                                    <Select
                                      onValueChange={(v) => field.onChange(Number(v))}
                                      value={field.value !== undefined ? String(field.value) : ""}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="0-2" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="0">0</SelectItem>
                                        <SelectItem value="1">1</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-around rounded-md border border-input bg-muted/40 p-3">
                        <p className="text-sm">
                          Nota APGAR 1 minuto:{" "}
                          <span className="font-semibold">{apgar1Total}/10</span>
                        </p>
                        <p className="text-sm">
                          Nota APGAR 5 minutos:{" "}
                          <span className="font-semibold">{apgar5Total}/10</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
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
                  <Textarea
                    placeholder="Descreva como foi o acompanhamento..."
                    rows={4}
                    {...field}
                  />
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
