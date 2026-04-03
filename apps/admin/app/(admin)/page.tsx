import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { Card } from "@ventre/ui/card";
import { Building2, CreditCard, Heart, Receipt, Users } from "lucide-react";

async function getStats() {
  const supabase = await createServerSupabaseAdmin();

  const [usersResult, enterprisesResult, plansResult, subscriptionsResult, patientsResult] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("enterprises").select("id", { count: "exact", head: true }),
      supabase.from("plans").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }),
      supabase.from("patients").select("id", { count: "exact", head: true }),
    ]);

  return {
    users: usersResult.count ?? 0,
    enterprises: enterprisesResult.count ?? 0,
    plans: plansResult.count ?? 0,
    subscriptions: subscriptionsResult.count ?? 0,
    patients: patientsResult.count ?? 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Usuários", value: stats.users, icon: Users, href: "/users" },
    { label: "Empresas", value: stats.enterprises, icon: Building2, href: "/enterprises" },
    { label: "Planos", value: stats.plans, icon: CreditCard, href: "/plans" },
    { label: "Assinaturas", value: stats.subscriptions, icon: Receipt, href: "/subscriptions" },
    { label: "Pacientes", value: stats.patients, icon: Heart, href: "/patients" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-bold text-2xl text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground text-sm">Visão geral da plataforma Nascere</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <a key={card.href} href={card.href} className="block">
              <Card className="p-6 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-2xl text-foreground">{card.value}</p>
                    <p className="text-muted-foreground text-sm">{card.label}</p>
                  </div>
                </div>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
