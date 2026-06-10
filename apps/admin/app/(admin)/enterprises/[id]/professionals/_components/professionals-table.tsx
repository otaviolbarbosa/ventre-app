"use client";

import { getEnterpriseProfessionalsAction } from "@/actions/enterprises";
import { formatDate } from "@/lib/utils";
import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { DataTable } from "@ventre/ui/shared/data-table";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type User = Tables<"users">;

const userTypeLabels: Record<string, string> = {
  professional: "Profissional",
  patient: "Paciente",
  manager: "Gestor",
  secretary: "Secretária",
  admin: "Admin",
};

const professionalTypeLabels: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
  fisio: "Fisioterapeuta",
};

export function ProfessionalsTable({ enterpriseId }: { enterpriseId: string }) {
  const [professionals, setProfessionals] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const lastFetchRef = useRef<{ page: number; size: number }>({ page: 1, size: 10 });

  const { execute: loadProfessionals } = useAction(getEnterpriseProfessionalsAction, {
    onSuccess: ({ data }) => {
      setProfessionals(data.data);
      setTotalPages(data.pagination.total_pages);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao carregar profissionais");
    },
  });

  const fetchData = useCallback(
    (page: number, size: number) => {
      lastFetchRef.current = { page, size };
      loadProfessionals({ enterpriseId, page, size });
    },
    [loadProfessionals, enterpriseId],
  );

  return (
    <DataTable
      data={professionals}
      totalPages={totalPages}
      fetchData={fetchData}
      options={{
        modelName: "Profissional",
        path: "users",
        fieldsToSearch: ["name", "email"],
        columns: [
          {
            label: "",
            name: "avatar_url",
            callback: (user) => <UserAvatar user={user} size={9} />,
          },
          {
            label: "Nome",
            name: "name",
            callback: (user) => (
              <div className="flex flex-col">
                <span>{user.name}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
              </div>
            ),
          },
          {
            label: "Tipo",
            name: "user_type",
            callback: (user) => (
              <Badge variant="default">{userTypeLabels[user.user_type] ?? user.user_type}</Badge>
            ),
          },
          {
            label: "Especialidade",
            name: "professional_type",
            callback: (user) =>
              user.professional_type
                ? (professionalTypeLabels[user.professional_type] ?? user.professional_type)
                : "—",
          },
          {
            label: "Criado em",
            name: "created_at",
            callback: (user) => formatDate(user.created_at),
          },
        ],
        actions: ["edit"],
      }}
    />
  );
}
