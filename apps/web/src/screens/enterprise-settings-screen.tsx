"use client";

import { Header } from "@/components/layouts/header";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@ventre/ui/card";
import { ChevronRight, FileText, Percent } from "lucide-react";
import Link from "next/link";

const settingsSections = [
  {
    title: "Taxas e Descontos",
    description: "Configure taxas fixas e percentuais aplicadas às cobranças",
    href: "/settings/billing-deductions",
    icon: Percent,
  },
  {
    title: "Modelos de Contrato",
    description: "Configure as cláusulas dos modelos contrato da organização",
    href: "/settings/contract",
    icon: FileText,
  },
];

export default function EnterpriseSettingsScreen() {
  return (
    <div>
      <Header title="Configurações" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {settingsSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{section.title}</p>
                    <p className="text-muted-foreground text-sm">{section.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
