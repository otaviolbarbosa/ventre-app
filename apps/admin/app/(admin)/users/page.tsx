import { Button } from "@ventre/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { UsersTable } from "./_components/users-table";

export default function UsersPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Usuários</h1>
        </div>
        <Button asChild>
          <Link href="/users/new">
            <Plus className="h-4 w-4" />
            Novo usuário
          </Link>
        </Button>
      </div>

      <UsersTable />
    </div>
  );
}
