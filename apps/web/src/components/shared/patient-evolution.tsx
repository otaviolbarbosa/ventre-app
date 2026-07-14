"use client";

import { createEvolutionAction } from "@/actions/create-evolution-action";
import { getPatientEvolutionsAction } from "@/actions/get-patient-evolutions-action";
import { EmptyState } from "@/components/shared/empty-state";
import { dayjs } from "@/lib/dayjs";
import { type CreateEvolutionInput, createEvolutionSchema } from "@/lib/validations/evolution";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Skeleton } from "@ventre/ui/skeleton";
import { Textarea } from "@ventre/ui/textarea";
import { ClipboardList, Loader2, Lock, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Evolution = {
  id: string;
  patient_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  is_public: boolean;
  professional: { id: string; name: string } | null;
};

type PatientEvolutionProps = {
  patientId: string;
};

function EvolutionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: CreateEvolutionInput) => void;
  loading: boolean;
}) {
  const form = useForm<CreateEvolutionInput>({
    resolver: zodResolver(createEvolutionSchema),
    defaultValues: { content: "", is_public: true },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Evolução</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva a evolução da paciente..." rows={6} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_public"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={!field.value}
                  onCheckedChange={(checked) => field.onChange(!checked)}
                />
              </FormControl>
              <FormLabel className="cursor-pointer font-normal text-sm">
                Evolução privada (visível apenas para mim)
              </FormLabel>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="submit" className="gradient-primary" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function PatientEvolution({ patientId }: PatientEvolutionProps) {
  const [showModal, setShowModal] = useState(false);

  const { execute: fetchEvolutions, result, isPending } = useAction(getPatientEvolutionsAction);
  const { executeAsync: submitEvolution, isPending: submitting } = useAction(createEvolutionAction);

  useEffect(() => {
    fetchEvolutions({ patientId });
  }, [fetchEvolutions, patientId]);

  const evolutions = (result.data?.evolutions ?? []) as Evolution[];

  const handleSubmit = async (data: CreateEvolutionInput) => {
    const res = await submitEvolution({ patientId, data });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    fetchEvolutions({ patientId });
    setShowModal(false);
    toast.success("Evolução registrada com sucesso");
  };

  if (isPending && evolutions.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-10" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="icon"
          className="gradient-primary flex md:hidden"
          onClick={() => setShowModal(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          className="gradient-primary hidden md:flex"
          onClick={() => setShowModal(true)}
        >
          <Plus className="h-4 w-4" />
          <span className="ml-2 hidden md:block">Adicionar Evolução</span>
        </Button>
      </div>

      {evolutions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma evolução registrada"
          description="Registre a evolução da paciente para acompanhar o histórico de atendimentos."
        >
          <Button size="sm" className="gradient-primary" onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Evolução
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {evolutions.map((evolution) => (
            <div
              key={evolution.id}
              className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <p className="whitespace-pre-wrap text-sm">{evolution.content}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  Registro adicionado por: {evolution.professional?.name || "Desconhecido"}, em{" "}
                  {dayjs(evolution.created_at).format("DD/MM/YYYY [às] HH:mm")}
                </p>
                {!evolution.is_public && (
                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                    <Lock className="h-3 w-3" />
                    Privada
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContentModal
        open={showModal}
        onOpenChange={setShowModal}
        title="Nova Evolução"
        description="Registre a evolução da paciente."
      >
        <EvolutionForm onSubmit={handleSubmit} loading={submitting} />
      </ContentModal>
    </div>
  );
}
