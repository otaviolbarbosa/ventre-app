"use client";
import { addPatientAction } from "@/actions/add-patient-action";
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
import { Textarea } from "@/components/ui/textarea";
import { type CreatePatientInput, createPatientSchema } from "@/lib/validations/patient";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Professional = {
  id: string;
  name: string | null;
  professional_type: string | null;
};

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeiro(a)",
  doula: "Doula",
};

type NewPatientModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  callback?: VoidFunction;
  professionals?: Professional[];
};

export default function NewPatientModal({
  showModal,
  setShowModal,
  callback,
  professionals,
}: NewPatientModalProps) {
  const { execute, status } = useAction(addPatientAction, {
    onSuccess: () => {
      toast.success("Paciente cadastrada com sucesso!");
      form.reset();
      callback?.();
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
      address: "",
      observations: "",
      professional_id: professionals?.[0]?.id ?? undefined,
    },
  });

  function onSubmit(data: CreatePatientInput) {
    execute(data);
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
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
                <FormLabel>Nome completo</FormLabel>
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
                  <FormLabel>Email (opcional)</FormLabel>
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

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Endereço completo" {...field} />
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
                <FormLabel>Observações (opcional)</FormLabel>
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
