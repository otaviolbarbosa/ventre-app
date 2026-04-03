import { Button } from "@ventre/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { EnterprisesTable } from "./_components/enterprises-table";

export default function EnterprisesPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Empresas</h1>
        </div>
        <Button asChild>
          <Link href="/enterprises/new">
            <Plus className="h-4 w-4" />
            Nova empresa
          </Link>
        </Button>
      </div>

      <EnterprisesTable />
    </div>
  );
}
