import { Button } from "@ventre/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PlansTable } from "./_components/plans-table";

export default function PlansPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Planos</h1>
        </div>
        <Button asChild>
          <Link href="/plans/new">
            <Plus className="h-4 w-4" />
            Novo plano
          </Link>
        </Button>
      </div>

      <PlansTable />
    </div>
  );
}
