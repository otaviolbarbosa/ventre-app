"use client";

import { useTransition } from "react";
import { Baby, Heart, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { setProfessionalType } from "@/actions/profile";
import type { Tables } from "@nascere/supabase";

type ProfessionalType = NonNullable<Tables<"users">["professional_type"]>;

const professionalTypes: {
  type: ProfessionalType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: "obstetra",
    label: "Obstetra",
    description: "Médico especializado em gestação e parto",
    icon: Stethoscope,
  },
  {
    type: "enfermeiro",
    label: "Enfermeiro(a)",
    description: "Profissional de enfermagem obstétrica",
    icon: Heart,
  },
  {
    type: "doula",
    label: "Doula",
    description: "Suporte contínuo durante a gestação e parto",
    icon: Baby,
  },
];

export default function SelectTypeScreen() {
  const [isPending, startTransition] = useTransition();

  function handleSelect(type: ProfessionalType) {
    startTransition(async () => {
      await setProfessionalType(type);
    });
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-poppins text-2xl font-semibold tracking-tight">
          Qual é o seu perfil?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecione sua área de atuação para personalizar sua experiência
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        {professionalTypes.map(({ type, label, description, icon: Icon }) => (
          <button
            key={type}
            type="button"
            disabled={isPending}
            onClick={() => handleSelect(type)}
            className="group"
          >
            <Card className="flex h-44 w-44 cursor-pointer flex-col items-center justify-center gap-3 p-4 transition-colors group-hover:bg-muted/50 group-disabled:cursor-not-allowed group-disabled:opacity-50">
              <Icon className="h-10 w-10 text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
