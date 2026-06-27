"use client";

import { lookupCepAction } from "@/actions/lookup-cep-action";
import { updateProfileAction } from "@/actions/update-profile-action";
import { ESTADOS_BR } from "@/lib/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputMask } from "@react-input/mask";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const editProfileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
  address: z
    .object({
      zipcode: z.string().optional(),
      street: z.string().optional(),
      number: z.string().optional(),
      complement: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
});

type EditProfileInput = z.infer<typeof editProfileSchema>;

type Address = {
  zipcode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

type EditProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  phone: string;
  address?: Address | null;
  onSuccess?: (name: string, phone: string) => void;
};

export function EditProfileModal({
  open,
  onOpenChange,
  name,
  phone,
  address,
  onSuccess,
}: EditProfileModalProps) {
  const [addressVisible, setAddressVisible] = useState(false);

  const form = useForm<EditProfileInput>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: {
        zipcode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
    },
  });

  useEffect(() => {
    if (open) {
      const hasAddress = !!(address?.street || address?.city || address?.zipcode);
      form.reset({
        name,
        phone,
        address: {
          zipcode: address?.zipcode ?? "",
          street: address?.street ?? "",
          number: address?.number ?? "",
          complement: address?.complement ?? "",
          neighborhood: address?.neighborhood ?? "",
          city: address?.city ?? "",
          state: address?.state ?? "",
        },
      });
      setAddressVisible(hasAddress);
    }
  }, [open, name, phone, address, form]);

  const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.street) form.setValue("address.street", data.street);
      if (data.neighborhood) form.setValue("address.neighborhood", data.neighborhood);
      if (data.city) form.setValue("address.city", data.city);
      if (data.state) form.setValue("address.state", data.state);
      setAddressVisible(true);
    },
    onError: () => {
      toast.error("CEP não encontrado");
      setAddressVisible(true);
    },
  });

  const isFetchingCep = cepStatus === "executing";

  const { executeAsync: saveProfile } = useAction(updateProfileAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      toast.success("Seu perfil foi atualizado com sucesso!");
    },
  });

  async function handleSubmit(values: EditProfileInput) {
    const result = await saveProfile(values);

    if (!result?.data?.profile) {
      toast.error(result?.serverError ?? "Erro ao salvar perfil");
      return;
    }

    onSuccess?.(result.data.profile.name ?? "", result.data.profile.phone ?? "");
    onOpenChange(false);
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Perfil"
      description="Atualize suas informações pessoais"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Seu nome completo" {...field} />
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
                    placeholder="(99) 99999-9999"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 pt-2">
            <p className="font-medium text-sm">Endereço</p>

            <FormField
              control={form.control}
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

            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="São Paulo" disabled={!addressVisible} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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

            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Rua</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua das Flores" disabled={!addressVisible} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="123" disabled={!addressVisible} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="address.complement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input placeholder="Apto 45" disabled={!addressVisible} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Centro" disabled={!addressVisible} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gradient-primary flex-1"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
