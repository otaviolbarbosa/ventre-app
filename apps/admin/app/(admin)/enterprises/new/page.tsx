import { EnterpriseCreateForm } from "./_components/enterprise-create-form";

export default function NewEnterprisePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Nova Empresa</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Cadastrar uma nova empresa na plataforma
        </p>
      </div>
      <EnterpriseCreateForm />
    </div>
  );
}
