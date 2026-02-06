"use client";
import { type UpdatePatientInput, updatePatientSchema } from "@/lib/validations/patient";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase";
import { InputMask } from "@react-input/mask";
import dayjs from "dayjs";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { ContentModal } from "./content-modal";
import InfoItem from "./info-item";

type PatientInfoProps = {
  patient: Tables<"patients">;
  onChange: () => Promise<void>;
};

export default function PatientInfo({ patient, onChange }: PatientInfoProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const form = useForm<UpdatePatientInput>({
    resolver: zodResolver(updatePatientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      due_date: "",
      dum: "",
      address: "",
      observations: "",
    },
  });

  function handleOpenEditModal() {
    form.reset({
      name: patient?.name || "",
      email: patient?.email || "",
      phone: patient?.phone || "",
      date_of_birth: patient?.date_of_birth || "",
      due_date: patient?.due_date || "",
      dum: patient?.dum || "",
      address: patient?.address || "",
      observations: patient?.observations || "",
    });
    setShowEditModal(true);
  }

  function handleCancelEdit() {
    setShowEditModal(false);
    form.reset();
  }

  async function onSubmit(data: UpdatePatientInput) {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/patients/${patient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar paciente");
      }

      //   const updated = await response.json();
      //   setPatient(updated.patient);
      await onChange();
      setShowEditModal(false);
      toast.success("Gestante atualizada com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar paciente");
    } finally {
      setIsSaving(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    form.reset({
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      date_of_birth: patient.date_of_birth,
      due_date: patient.due_date,
      dum: patient.dum || "",
      address: patient.address || "",
      observations: patient.observations || "",
    });
  }, [patient]);

  return (
    <>
      <InfoItem label="Nome completo" value={patient.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Email" value={patient.email} />
        <InfoItem label="Telefone" value={patient.phone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem
          label="Data de nascimento"
          value={patient.date_of_birth ? dayjs(patient.date_of_birth).format("DD/MM/YYYY") : null}
        />
        <InfoItem
          label="Data prevista do parto (DPP)"
          value={patient.due_date ? dayjs(patient.due_date).format("DD/MM/YYYY") : null}
        />
      </div>

      <InfoItem
        label="Data da última menstruação (DUM)"
        value={patient.dum ? dayjs(patient.dum).format("DD/MM/YYYY") : null}
      />

      <InfoItem label="Endereço" value={patient.address} />

      <InfoItem label="Observações" value={patient.observations} />

      <Button
        variant="outline"
        className="absolute top-0 right-0"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenEditModal();
        }}
      >
        <Pencil className="h-4 w-4" />
        <span className="ml-2 block">Editar</span>
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
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            <FormField
              control={form.control}
              name="dum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da última menstruação (DUM)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} readOnly className="bg-muted" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
