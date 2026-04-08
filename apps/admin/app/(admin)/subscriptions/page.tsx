import { SubscriptionsTable } from "./_components/subscriptions-table";

export default function SubscriptionsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Assinaturas</h1>
      </div>

      <SubscriptionsTable />
    </div>
  );
}
