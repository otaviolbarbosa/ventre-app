"use client";
import { updatePatientAction } from "@/actions/update-patient-action";
import { type UpdatePatientInput, updatePatientSchema } from "@/lib/validations/patient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase";
import { InputMask } from "@react-input/mask";
import dayjs from "dayjs";
import { Loader2, Pencil } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ContentModal } from "./content-modal";
import InfoItem from "./info-item";

type PatientInfoProps = {
  patient: Tables<"patients"> & {
    due_date?: string | null;
    dum?: string | null;
    observations?: string | null;
  };
  onChange: () => Promise<void>;
};

export default function PatientInfo({ patient, onChange }: PatientInfoProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const { executeAsync, isPending: isSaving } = useAction(updatePatientAction);

  const form = useForm<UpdatePatientInput>({
    resolver: zodResolver(updatePatientSchema),
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
    },
  });

  function handleOpenEditModal() {
    form.reset({
      name: patient?.name || "",
      email: patient?.email || "",
      phone: patient?.phone || "",
      due_date: patient?.due_date ?? "",
      dum: patient?.dum || "",
      street: patient?.street || "",
      neighborhood: patient?.neighborhood || "",
      complement: patient?.complement || "",
      number: patient?.number || "",
      city: patient?.city || "",
      state: patient?.state || "",
      zipcode: patient?.zipcode || "",
      observations: patient?.observations || "",
    });
    setShowEditModal(true);
  }

  function handleCancelEdit() {
    setShowEditModal(false);
    form.reset();
  }

  async function onSubmit(data: UpdatePatientInput) {
    const result = await executeAsync({ patientId: patient.id, data });

    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }

    await onChange();
    setShowEditModal(false);
    toast.success("Gestante atualizada com sucesso!");
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to overload dependencies
  useEffect(() => {
    form.reset({
      name: patient.name,
      email: patient.email ?? undefined,
      phone: patient.phone,
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
  }, [patient]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Nome completo" value={patient.name} />
        <InfoItem
          label="Data de nascimento"
          value={patient.date_of_birth ? dayjs(patient.date_of_birth).format("DD/MM/YYYY") : null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Email" value={patient.email} />
        <InfoItem label="Telefone" value={patient.phone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem
          label="Data prevista do parto (DPP)"
          value={patient.due_date ? dayjs(patient.due_date).format("DD/MM/YYYY") : null}
        />
        <InfoItem
          label="Data da última menstruação (DUM)"
          value={patient.dum ? dayjs(patient.dum).format("DD/MM/YYYY") : null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoItem label="CEP" value={patient.zipcode} />
        <InfoItem label="Estado" value={patient.state} />
        <InfoItem label="Cidade" value={patient.city} />
      </div>

      <InfoItem label="Rua" value={patient.street} />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoItem label="Número" value={patient.number} />
        <InfoItem label="Complemento" value={patient.complement} />
        <InfoItem label="Bairro" value={patient.neighborhood} />
      </div>

      <InfoItem label="Observações" value={patient.observations} />

      <Button
        variant="outline"
        className="absolute top-0 right-0 hidden md:flex"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenEditModal();
        }}
      >
        <Pencil className="h-4 w-4" />
        <span className="ml-2 block">Editar</span>
      </Button>

      <Button
        size="icon"
        variant="outline"
        className="absolute top-0 right-0 flex md:hidden"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenEditModal();
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <ContentModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
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
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const dpp = e.target.value;
                          if (dpp) {
                            const dppDate = new Date(`${dpp}T00:00:00`);
                            dppDate.setDate(dppDate.getDate() - 280);
                            form.setValue("dum", dppDate.toISOString().split("T")[0]);
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
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="00000-000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
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
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
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
    </>
  );
}
