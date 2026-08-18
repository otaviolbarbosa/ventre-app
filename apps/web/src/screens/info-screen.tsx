const APP_NAME = "Ventre";
const APP_VERSION = "1.0.0";

export default function InfoScreen() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center">
        <h2 className="font-semibold text-lg">{APP_NAME}</h2>
        <p className="text-muted-foreground text-sm">
          Gestão de Saúde para Profissionais do Parto e Gestantes
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 font-semibold text-base">Sobre o aplicativo</h3>
        <div className="divide-y">
          <div className="flex items-center justify-between py-3">
            <span className="text-muted-foreground text-sm">Nome</span>
            <span className="font-medium text-sm">{APP_NAME}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-muted-foreground text-sm">Versão</span>
            <span className="font-medium text-sm">{APP_VERSION}</span>
          </div>
        </div>
      </div>

      <p className="text-center text-muted-foreground text-xs">
        © {currentYear} {APP_NAME}. Todos os direitos reservados.
      </p>
    </div>
  );
}
