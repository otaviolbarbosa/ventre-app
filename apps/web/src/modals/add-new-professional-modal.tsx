"use client";

import { addNewProfessionalAction } from "@/actions/add-new-professional-action";
import { professionalTypeLabels } from "@/utils/team";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  phone: z.string().min(10, "Telefone inválido"),
  professional_type: z.enum(["obstetra", "enfermeiro", "doula"], {
    required_error: "Selecione a especialidade",
  }),
});

type FormValues = z.infer<typeof schema>;

type AddNewProfessionalModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
  initialQuery?: string;
};

export default function AddNewProfessionalModal({
  showModal,
  setShowModal,
  onSuccess,
  initialQuery,
}: AddNewProfessionalModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      professional_type: undefined,
    },
  });

  useEffect(() => {
    if (!showModal) return;
    if (!initialQuery) return;
    const isEmail = initialQuery.includes("@");
    if (isEmail) {
      form.setValue("email", initialQuery);
    } else {
      form.setValue("name", initialQuery);
    }
  }, [showModal, initialQuery, form]);

  const { execute, isExecuting } = useAction(addNewProfessionalAction, {
    onSuccess: ({ data }) => {
      toast.success(`Convite enviado para ${data?.name ?? "profissional"}!`);
      form.reset();
      onSuccess?.();
      setShowModal(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao cadastrar profissional.");
    },
  });

  function handleClose(open: boolean) {
    if (!open) form.reset();
    setShowModal(open);
  }

  return (
    <ContentModal
      open={showModal}
      onOpenChange={handleClose}
      title="Cadastrar nova profissional"
      description="Preencha os dados da profissional. Um e-mail será enviado para ela finalizar o cadastro."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-3 py-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Maria Silva" disabled={isExecuting} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="maria@exemplo.com"
                    disabled={isExecuting}
                    {...field}
                  />
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
                    placeholder="(99) 99999-9999"
                    mask="(__) _____-____"
                    replacement={{ _: /\d/ }}
                    disabled={isExecuting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="professional_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Especialidade</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isExecuting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a especialidade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(professionalTypeLabels).map(([value, label]) => (
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

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={isExecuting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={isExecuting}>
              {isExecuting ? "Enviando convite..." : "Enviar convite"}
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
