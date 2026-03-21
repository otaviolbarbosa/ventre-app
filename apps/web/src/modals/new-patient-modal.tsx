"use client";
import { addPatientAction } from "@/actions/add-patient-action";
import { lookupCepAction } from "@/actions/lookup-cep-action";
import { CurrencyInput } from "@/components/billing/currency-input";
import { ContentModal } from "@/components/shared/content-modal";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type CreatePatientInput, createPatientSchema } from "@/lib/validations/patient";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Professional = {
  id: string;
  name: string | null;
  professional_type: string | null;
};

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
};

const ESTADOS_BR = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

type NewPatientModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
  professionals?: Professional[];
};

export default function NewPatientModal({
  showModal,
  setShowModal,
  onSuccess,
  professionals,
}: NewPatientModalProps) {
  const [addressVisible, setAddressVisible] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

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
      toast.error("CEP não encontrado");
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { execute, status } = useAction(addPatientAction, {
    onSuccess: () => {
      toast.success("Paciente cadastrada com sucesso!");
      form.reset();
      setAddressVisible(false);
      setShowBilling(false);
      onSuccess?.();
      setShowModal(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao cadastrar paciente");
    },
  });

  const isSubmitting = status === "executing";
  const showProfessionalSelector = professionals && professionals.length > 0;

  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
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
      professional_id: professionals?.[0]?.id ?? undefined,
    },
  });

  function toggleBilling(enabled: boolean) {
    setShowBilling(enabled);
    if (enabled) {
      form.setValue("billing", {
        description: "",
        total_amount: 0,
        payment_method: undefined as unknown,
        installment_count: 1,
        installment_interval: 1,
        first_due_date: "",
        notes: "",
      } as CreatePatientInput["billing"]);
    } else {
      form.setValue("billing", undefined as CreatePatientInput["billing"]);
    }
  }

  function onSubmit(data: CreatePatientInput) {
    execute(data);
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
          setAddressVisible(false);
          setShowBilling(false);
        }
        setShowModal(open);
      }}
      title="Nova Gestante"
      description="Preencha os dados da gestante. O profissional selecionado será adicionado automaticamente como membro da equipe."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {showProfessionalSelector && (
            <FormField
              control={form.control}
              name="professional_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional responsável</FormLabel>
                  <FormControl>
                    <select
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {professionals.map((prof) => (
                        <option key={prof.id} value={prof.id}>
                          {prof.name ?? "Sem nome"}{" "}
                          {prof.professional_type
                            ? `(${PROFESSIONAL_TYPE_LABELS[prof.professional_type] ?? prof.professional_type})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo *</FormLabel>
                <FormControl>
                  <Input placeholder="Nome da paciente" {...field} />
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
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data prevista do parto (DPP) *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const dpp = e.target.value;
                        if (dpp) {
                          const dppDate = dayjs(dpp);
                          form.setValue("dum", dppDate.subtract(280, "day").format("YYYY-MM-DD"));
                        } else {
                          form.setValue("dum", "");
                        }
                      }}
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
                    <Input type="date" {...field} readOnly className="bg-muted" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="zipcode"
              render={({ field }) => (
                <FormItem className="sm:col-span-1">
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
          </div>

          {addressVisible && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <select
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className="flex h-10 w-full rounded-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Selecione</option>
                          {ESTADOS_BR.map((estado) => (
                            <option key={estado.sigla} value={estado.sigla}>
                              {estado.nome}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rua</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua das Flores" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="complement"
                  render={({ field }) => (
                    <FormItem>
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
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Centro" {...field} />
                      </FormControl>
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
                  <Textarea
                    placeholder="Informações adicionais sobre a paciente"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => toggleBilling(!showBilling)}
              className="flex w-full items-center gap-2 rounded-md border border-dashed p-3 text-muted-foreground text-sm transition-colors hover:border-primary hover:text-primary"
            >
              <span className="font-medium">
                {showBilling ? "− Remover dados de pagamento" : "+ Adicionar dados de pagamentos"}
              </span>
            </button>
          </div>

          {showBilling && (
            <div className="space-y-4 rounded-md border p-4">
              <p className="font-medium text-sm">Dados da Cobrança</p>

              <FormField
                control={form.control}
                name="billing.description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Acompanhamento pré-natal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billing.total_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total *</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value ?? 0} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billing.payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de Pagamento *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o método" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="debito">Cartão de Débito</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="billing.installment_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcelas *</FormLabel>
                      <Select
                        value={String(field.value ?? 1)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x
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
                  name="billing.installment_interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo *</FormLabel>
                      <Select
                        value={String(field.value ?? 1)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Mensal</SelectItem>
                          <SelectItem value="2">Bimestral</SelectItem>
                          <SelectItem value="3">Trimestral</SelectItem>
                          <SelectItem value="4">Quadrimestral</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="billing.first_due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento da 1ª parcela *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billing.notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações da cobrança</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notas sobre a cobrança" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Paciente
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
