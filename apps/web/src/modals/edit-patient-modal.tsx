"use client";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { updatePatientAction } from "@/actions/update-patient-action";
import { ESTADOS_BR } from "@/lib/constants";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { type UpdatePatientInput, updatePatientSchema } from "@/lib/validations/patient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@ventre/supabase";
import { InputMask } from "@react-input/mask";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Textarea } from "@ventre/ui/textarea";
import { Loader2 } from "lucide-react";

import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type PatientWithPrenatalDates = Tables<"patients"> & {
  due_date?: string | null;
  dum?: string | null;
  observations?: string | null;
};

type EditPatientModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientWithPrenatalDates;
  onSuccess: () => Promise<void>;
};

function hasAddress(patient: PatientWithPrenatalDates) {
  return !!(patient.zipcode || patient.street || patient.city);
}

export function EditPatientModal({
  open,
  onOpenChange,
  patient,
  onSuccess,
}: EditPatientModalProps) {
  const [addressVisible, setAddressVisible] = useState(false);

  const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.street) form.setValue("street", data.street);
      if (data.neighborhood) form.setValue("neighborhood", data.neighborhood);
      if (data.city) form.setValue("city", data.city);
      if (data.state) form.setValue("state", data.state);
      setAddressVisible(true);
    },
    onError: () => {
      toast.error("CEP não encontrado. Preencha o endereço manualmente.");
      setAddressVisible(true);
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { executeAsync, isPending: isSaving } = useAction(updatePatientAction);

  const form = useForm<UpdatePatientInput>({
    resolver: zodResolver(updatePatientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      partner_name: "",
      due_date: "",
      dum: "",
      street: "",
      neighborhood: "",
      complement: "",
      number: "",
      city: "",
      state: "",
      zipcode: "",
      observations: "",
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when patient or open changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: patient.name,
        email: patient.email ?? undefined,
        phone: patient.phone,
        partner_name: patient.partner_name || "",
        due_date: patient.due_date ?? undefined,
        dum: patient.dum || "",
        street: patient.street || "",
        neighborhood: patient.neighborhood || "",
        complement: patient.complement || "",
        number: patient.number || "",
        city: patient.city || "",
        state: patient.state || "",
        zipcode: patient.zipcode || "",
        observations: patient.observations || "",
      });
      setAddressVisible(hasAddress(patient));
    }
  }, [open, patient]);

  async function onSubmit(data: UpdatePatientInput) {
    const result = await executeAsync({ patientId: patient.id, data });

    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }

    await onSuccess();
    onOpenChange(false);
    toast.success("Gestante atualizada com sucesso!");
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Paciente"
      description="Atualize os dados da gestante"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="partner_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do parceiro</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <InputMask
                      component={Input}
                      mask="(__) _____-____"
                      replacement={{ _: /\d/ }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data prevista do parto (DPP)</FormLabel>
                  <FormControl>
                    <DatePicker
                      selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                      onChange={(date) => {
                        field.onChange(date ? date.toISOString().slice(0, 10) : "");
                        if (date) {
                          const dum = new Date(date);
                          dum.setDate(dum.getDate() - 280);
                          form.setValue("dum", dum.toISOString().slice(0, 10));
                        } else {
                          form.setValue("dum", "");
                        }
                      }}
                      placeholderText="Selecione a data"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Última menstruação (DUM)</FormLabel>
                  <FormControl>
                    <DatePicker
                      selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                      onChange={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
                      placeholderText="Calculado automaticamente"
                      disabled
                      className="bg-muted"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="zipcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputMask
                      component={Input}
                      mask="_____-___"
                      replacement={{ _: /\d/ }}
                      placeholder="00000-000"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const digits = e.target.value.replace(/\D/g, "");
                        if (digits.length === 8) {
                          lookupCep({ cep: digits });
                        }
                        if (digits.length < 8) {
                          setAddressVisible(false);
                        }
                      }}
                    />
                    {isFetchingCep && (
                      <div className="absolute inset-y-0 right-3 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {addressVisible && (
            <>
              {/* Rua (3 cols) | Número (1 col) */}
              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua das Flores" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Complemento (2 cols) | Bairro (2 cols) */}
              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="complement"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto 45" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Centro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Cidade (2 cols) | UF (1 col) */}
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>UF</FormLabel>
                      <Select
                        value={field.value ?? undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ESTADOS_BR.map((estado) => (
                            <SelectItem key={estado.sigla} value={estado.sigla}>
                              {estado.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
