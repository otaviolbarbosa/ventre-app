"use client";
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
import {
  type CreateAppointmentInput,
  createAppointmentSchema,
} from "@/lib/validations/appointment";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Tables } from "@nascere/supabase";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Patient = Tables<"patients">;

type NewAppointmentModalProps = {
  patientId?: string;
  patients: Patient[];
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  callback?: VoidFunction;
};
export default function NewAppointmentModal({
  patientId,
  patients,
  showModal,
  setShowModal,
  callback,
}: NewAppointmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      patient_id: patientId,
      date: "",
      time: "",
      type: undefined,
      duration: 60,
      location: "",
      notes: "",
    },
  });

  async function onSubmit(data: CreateAppointmentInput) {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar agendamento");
      }

      toast.success("Agendamento criado com sucesso!");

      callback?.();
      setShowModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar agendamento");
    } finally {
      setIsSubmitting(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    form.reset({
      patient_id: patientId,
      date: "",
      time: "",
      type: undefined,
      duration: 60,
      location: "",
      notes: "",
    });
  }, []);

  return (
    <ContentModal
      open={showModal}
      onOpenChange={setShowModal}
      title="Novo Agendamento"
      description="Agende uma consulta ou encontro com a paciente"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!patientId && (
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a paciente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de agendamento</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="encontro">Encontro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (minutos)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    {...field}
                    onChange={(e) => field.onChange(Number.parseInt(e.target.value) || undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Local (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Endereço ou descrição do local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Notas sobre o agendamento" rows={3} {...field} />
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
              Salvar
            </Button>
          </div>
        </form>
      </Form>
    </ContentModal>
  );
}
