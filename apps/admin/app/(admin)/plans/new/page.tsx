import { PlanCreateForm } from "./_components/plan-create-form";

export default function NewPlanPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Novo Plano</h1>
        <p className="mt-1 text-muted-foreground text-sm">Criar um novo plano na plataforma</p>
      </div>
      <PlanCreateForm />
    </div>
  );
}
