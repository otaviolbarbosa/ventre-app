import { WhatsAppTestForm } from "./_components/whatsapp-test-form";

export default function WhatsAppTestPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Teste de WhatsApp</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Envia um template real via WhatsApp Business API para o número informado
        </p>
      </div>
      <WhatsAppTestForm />
    </div>
  );
}
