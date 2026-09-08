"use client";

import { createEvolutionAction } from "@/actions/create-evolution-action";
import { editEvolutionAction } from "@/actions/edit-evolution-action";
import { getPatientEvolutionsAction } from "@/actions/get-patient-evolutions-action";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { dayjs } from "@/lib/dayjs";
import { type CreateEvolutionInput, createEvolutionSchema } from "@/lib/validations/evolution";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { Skeleton } from "@ventre/ui/skeleton";
import { Textarea } from "@ventre/ui/textarea";
import { ClipboardList, Loader2, Lock, Pencil, Plus } from "lucide-react";
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
  updated_at: string;
  is_public: boolean;
  hasUpdatedContent: boolean;
  professional: { id: string; name: string; avatar_url: string | null } | null;
};

type PatientEvolutionProps = {
  patientId: string;
};

function EvolutionForm({
  onSubmit,
  loading,
  defaultValues,
}: {
  onSubmit: (data: CreateEvolutionInput) => void;
  loading: boolean;
  defaultValues?: CreateEvolutionInput;
}) {
  const form = useForm({
    resolver: zodResolver(createEvolutionSchema),
    defaultValues: defaultValues ?? { content: "", is_public: true },
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
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingEvolution, setEditingEvolution] = useState<Evolution | null>(null);

  const { execute: fetchEvolutions, result, isPending } = useAction(getPatientEvolutionsAction);
  const { executeAsync: submitEvolution, isPending: submitting } = useAction(createEvolutionAction);
  const { executeAsync: submitEdit, isPending: editSubmitting } = useAction(editEvolutionAction);

  useEffect(() => {
    fetchEvolutions({ patientId });
  }, [fetchEvolutions, patientId]);

  const evolutions = (result.data?.evolutions ?? []) as Evolution[];

  const closeModal = () => {
    setShowModal(false);
    setEditingEvolution(null);
  };

  const handleSubmit = async (data: CreateEvolutionInput) => {
    const res = await submitEvolution({ patientId, data });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    fetchEvolutions({ patientId });
    closeModal();
    toast.success("Evolução registrada com sucesso");
  };

  const handleEditSubmit = async (data: CreateEvolutionInput) => {
    if (!editingEvolution) return;

    const res = await submitEdit({ evolutionId: editingEvolution.id, data });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    fetchEvolutions({ patientId });
    closeModal();
    toast.success("Evolução atualizada com sucesso");
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
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm">{evolution.content}</p>
                {evolution.professional_id === user?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    aria-label="Editar evolução"
                    onClick={() => setEditingEvolution(evolution)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    user={{
                      name: evolution.professional?.name || "Desconhecido",
                      avatar_url: evolution.professional?.avatar_url,
                    }}
                    size={6}
                  />
                  <div className="text-muted-foreground text-xs">
                    <p className="font-medium text-foreground">
                      {evolution.professional?.name || "Desconhecido"}
                    </p>
                    <p>{dayjs(evolution.created_at).format("DD/MM/YYYY [às] HH:mm")}</p>
                    {evolution.hasUpdatedContent && (
                      <p>
                        Última edição em{" "}
                        {dayjs(evolution.updated_at).format("DD/MM/YYYY [às] HH:mm")}
                      </p>
                    )}
                  </div>
                </div>
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
        onOpenChange={(open) => (open ? setShowModal(true) : closeModal())}
        title="Nova Evolução"
        description="Registre a evolução da paciente."
      >
        <EvolutionForm onSubmit={handleSubmit} loading={submitting} />
      </ContentModal>

      <ContentModal
        open={editingEvolution !== null}
        onOpenChange={(open) => (open ? undefined : closeModal())}
        title="Editar Evolução"
        description="Atualize a evolução da paciente."
      >
        {editingEvolution && (
          <EvolutionForm
            key={editingEvolution.id}
            onSubmit={handleEditSubmit}
            loading={editSubmitting}
            defaultValues={{
              content: editingEvolution.content,
              is_public: editingEvolution.is_public,
            }}
          />
        )}
      </ContentModal>
    </div>
  );
}
