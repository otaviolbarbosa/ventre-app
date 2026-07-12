"use client";

import { completePatientRegistrationPostOAuthAction } from "@/actions/complete-patient-registration-post-oauth-action";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import {
  type LinkExistingPatientRegistrationInput,
  linkExistingPatientRegistrationSchema,
  type PatientSelfRegistrationInput,
  patientSelfRegistrationSchema,
} from "@/lib/validations/patient-invite";
import { ESTADOS_BR } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import { Textarea } from "@ventre/ui/textarea";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Invite = {
  id: string;
  invite_type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type LinkedPatient = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
};

const type1Schema = patientSelfRegistrationSchema.omit({ password: true });
type Type1Values = Omit<PatientSelfRegistrationInput, "password">;

const type2Schema = linkExistingPatientRegistrationSchema.omit({ password: true });
type Type2Values = Omit<LinkExistingPatientRegistrationInput, "password">;

export default function PatientRegisterCompleteScreen({
  invite,
  linkedPatient,
}: {
  invite: Invite;
  linkedPatient: LinkedPatient | null;
}) {
  const router = useRouter();
  const isType1 = invite.invite_type === "new_patient";
  const [addressVisible, setAddressVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const type1Form = useForm<Type1Values>({
    resolver: zodResolver(type1Schema),
    defaultValues: {
      name: invite.name ?? "",
      email: invite.email ?? "",
      phone: invite.phone ?? "",
      partner_name: "",
      baby_name: "",
      due_date: "",
      dum: "",
      observations: "",
      address: {
        street: "",
        neighborhood: "",
        complement: "",
        number: "",
        city: "",
        state: "",
        zipcode: "",
      },
    },
  });

  const type2Form = useForm<Type2Values>({
    resolver: zodResolver(type2Schema),
    defaultValues: { phone: linkedPatient?.phone ?? "" },
  });

  const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.street) type1Form.setValue("address.street", data.street);
      if (data.neighborhood) type1Form.setValue("address.neighborhood", data.neighborhood);
      if (data.city) type1Form.setValue("address.city", data.city);
      if (data.state) type1Form.setValue("address.state", data.state);
      setAddressVisible(true);
    },
    onError: () => {
      toast.error("CEP não encontrado");
      setAddressVisible(true);
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { executeAsync } = useAction(completePatientRegistrationPostOAuthAction);

  async function handleSubmitType1(values: Type1Values) {
    setIsFinishing(true);
    try {
      const result = await executeAsync({ inviteId: invite.id, ...values });
      if (!result?.data?.success) {
        toast.error(result?.serverError ?? "Erro ao concluir cadastro.");
        return;
      }
      router.push("/home");
    } finally {
      setIsFinishing(false);
    }
  }

  async function handleSubmitType2(values: Type2Values) {
    setIsFinishing(true);
    try {
      const result = await executeAsync({ inviteId: invite.id, phone: values.phone });
      if (!result?.data?.success) {
        toast.error(result?.serverError ?? "Erro ao concluir cadastro.");
        return;
      }
      router.push("/home");
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFAF5] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="https://ventre.app/logo.png"
            alt="Ventre"
            width={120}
            className="mx-auto mb-6 object-contain"
          />
          <h1 className="font-bold text-2xl text-[#433831]">Complete seu cadastro</h1>
          <p className="mt-1 text-[#81726C] text-sm">
            Só falta confirmar alguns dados para começar
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          {isType1 ? (
            <Form {...type1Form}>
              <form
                onSubmit={type1Form.handleSubmit(handleSubmitType1)}
                className="space-y-4"
              >
                <FormField
                  control={type1Form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={type1Form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data prevista do parto (DPP) *</FormLabel>
                        <FormControl>
                          <DatePicker
                            selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                            onChange={(date) => {
                              field.onChange(date ? date.toISOString().slice(0, 10) : "");
                              if (date) {
                                type1Form.setValue(
                                  "dum",
                                  dayjs(date).subtract(280, "day").format("YYYY-MM-DD"),
                                );
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
                    control={type1Form.control}
                    name="dum"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Última menstruação (DUM)</FormLabel>
                        <FormControl>
                          <DatePicker
                            selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                            onChange={(date) =>
                              field.onChange(date ? date.toISOString().slice(0, 10) : "")
                            }
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
                  control={type1Form.control}
                  name="address.zipcode"
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
                              if (digits.length === 8) lookupCep({ cep: digits });
                              if (digits.length < 8) setAddressVisible(false);
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

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={type1Form.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-3">
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={type1Form.control}
                    name="address.number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={type1Form.control}
                    name="address.neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={type1Form.control}
                    name="address.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input disabled={!addressVisible} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={type1Form.control}
                    name="address.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select
                          value={field.value ?? undefined}
                          onValueChange={field.onChange}
                          disabled={!addressVisible}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ESTADOS_BR.map((estado) => (
                              <SelectItem key={estado.sigla} value={estado.sigla}>
                                {estado.sigla}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={type1Form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="gradient-primary mt-2 w-full"
                  disabled={isFinishing}
                >
                  {isFinishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Finalizar cadastro
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...type2Form}>
              <form
                onSubmit={type2Form.handleSubmit(handleSubmitType2)}
                className="space-y-5"
              >
                <FormField
                  control={type2Form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
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

                <Button
                  type="submit"
                  className="gradient-primary mt-2 w-full"
                  disabled={isFinishing}
                >
                  {isFinishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Finalizar cadastro
                </Button>
              </form>
            </Form>
          )}
        </div>

        <p className="mt-6 text-center text-muted-foreground text-xs">
          © {new Date().getFullYear()} Ventre. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
