"use client";

import { sendConfirmationEmailAction } from "@/actions/patients";
import { deleteUserAction, getPaginatedUsersAction } from "@/actions/users";
import { formatDate } from "@/lib/utils";
import type { UserWithEnterprise } from "@/types";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { DataTable } from "@ventre/ui/shared/data-table";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { Copy, ExternalLink, LoaderCircle, UserCheck } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type User = UserWithEnterprise & { email_confirmed: boolean };

const userTypeLabels: Record<string, string> = {
  professional: "Profissional",
  patient: "Paciente",
  manager: "Gestor",
  secretary: "Secretária",
  admin: "Admin",
};

const professionalTypeLabels: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeiro(a)",
  doula: "Doula",
};

export function UsersTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const lastFetchRef = useRef<{ page: number; size: number }>({ page: 1, size: 10 });

  const { execute: loadUsers } = useAction(getPaginatedUsersAction, {
    onSuccess: ({ data }) => {
      setUsers(data.data);
      setTotalPages(data.pagination.total_pages);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao carregar usuários");
    },
  });

  const { execute: deleteUser } = useAction(deleteUserAction, {
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      loadUsers(lastFetchRef.current);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao excluir usuário");
    },
  });

  const {
    execute: sendConfirmationEmail,
    isExecuting,
    isPending,
  } = useAction(sendConfirmationEmailAction, {
    onSuccess: () => toast.success("E-mail de confirmação enviado!"),
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao enviar e-mail"),
  });

  const fetchData = useCallback(
    (page: number, size: number) => {
      lastFetchRef.current = { page, size };
      loadUsers({ page, size });
    },
    [loadUsers],
  );

  return (
    <DataTable
      data={users}
      totalPages={totalPages}
      fetchData={fetchData}
      onDeleteAction={(id) => deleteUser({ id })}
      options={{
        modelName: "Usuário",
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
                <button
                  type="button"
                  className="group flex w-fit items-center gap-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(user.email);
                    toast.success("Email copiado!");
                  }}
                >
                  <span>{user.email}</span>
                  <Copy className="size-2.5 transition-opacity md:opacity-0 md:group-hover:opacity-100" />
                </button>
              </div>
            ),
          },
          // { label: "E-mail", name: "email" },
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
            label: "Empresa",
            name: "enterprises",
            callback: (user) => {
              const enterprise = user.enterprises?.[0];
              return enterprise ? (
                <Link
                  href={`/enterprises/${enterprise.id}`}
                  className="group flex items-center gap-2 hover:text-primary"
                >
                  <span className="">{enterprise.name}</span>
                  <ExternalLink className="size-3 transition-opacity md:opacity-0 md:group-hover:opacity-100" />
                </Link>
              ) : (
                "-"
              );
            },
          },
          {
            label: "Criado em",
            name: "created_at",
            callback: (user) => formatDate(user.created_at),
          },
          {
            label: "Ativo?",
            name: "email_confirmed",
            callback: (user) =>
              user.email_confirmed ? (
                <Badge variant="default">Sim</Badge>
              ) : (
                <Badge variant="secondary">Não</Badge>
              ),
          },
        ],
        actions: [
          (ent) =>
            ent.email && !ent.email_confirmed ? (
              <Button
                size="icon-sm"
                variant="outline"
                title="Enviar e-mail de confirmação"
                disabled={isExecuting || isPending}
                onClick={() =>
                  ent.email_confirmed ? null : sendConfirmationEmail({ email: ent.email })
                }
              >
                {isExecuting || isPending ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <UserCheck />
                )}
              </Button>
            ) : null,

          "edit",
          "delete",
        ],
      }}
    />
  );
}
