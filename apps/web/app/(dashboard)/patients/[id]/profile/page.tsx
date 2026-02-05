"use client";

import { dayjs } from "@/lib/dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/shared/confirm-modal";
import { ContentModal } from "@/components/shared/content-modal";
import { LoadingCard } from "@/components/shared/loading-state";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { type UpdatePatientInput, updatePatientSchema } from "@/lib/validations/patient";
import type { Tables } from "@nascere/supabase/types";
import { InputMask } from "@react-input/mask";

type Patient = Tables<"patients">;

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const patientId = params.id as string;

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

  useEffect(() => {
    async function fetchPatient() {
      const response = await fetch(`/api/patients/${patientId}`);
      const data = await response.json();
      if (data.patient) {
        setPatient(data.patient);
        form.reset({
          name: data.patient.name,
          email: data.patient.email,
          phone: data.patient.phone,
          date_of_birth: data.patient.date_of_birth,
          due_date: data.patient.due_date,
          dum: data.patient.dum || "",
          address: data.patient.address || "",
          observations: data.patient.observations || "",
        });
      }
      setLoading(false);
    }
    fetchPatient();
  }, [patientId, form]);

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
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar paciente");
      }

      const updated = await response.json();
      setPatient(updated.patient);
      setShowEditModal(false);
      toast.success("Paciente atualizada com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar paciente");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir paciente");
      }

      toast.success("Paciente excluída com sucesso!");
      router.push("/patients");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir paciente");
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return <LoadingCard />;
  }

  if (!patient) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="informacoes">
            <AccordionTrigger className="font-semibold text-base">
              <div className="flex w-full items-center justify-between pr-4">
                <span>Informações da Paciente</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="relative space-y-4 pt-4">
              <InfoItem label="Nome completo" value={patient.name} />

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem label="Email" value={patient.email} />
                <InfoItem label="Telefone" value={patient.phone} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem
                  label="Data de nascimento"
                  value={
                    patient.date_of_birth ? dayjs(patient.date_of_birth).format("DD/MM/YYYY") : null
                  }
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cartao-prenatal">
            <AccordionTrigger className="font-semibold text-base">
              Cartão Pré-natal
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">Em breve...</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="documentos">
            <AccordionTrigger className="font-semibold text-base">Documentos</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">Em breve...</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="evolucao">
            <AccordionTrigger className="font-semibold text-base">
              Evolução da Paciente
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">Em breve...</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button variant="destructive" className="w-full" onClick={() => setShowDeleteDialog(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir Paciente
        </Button>
      </div>

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
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </ContentModal>

      <ConfirmModal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Excluir paciente"
        description="Tem certeza que deseja excluir esta paciente? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos."
        confirmLabel="Excluir"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
