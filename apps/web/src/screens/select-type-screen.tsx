"use client";

import { setProfessionalTypeAction } from "@/actions/set-professional-type-action";
import { Card } from "@/components/ui/card";
import type { Tables } from "@nascere/supabase";
import { Baby, Heart, Stethoscope } from "lucide-react";
import { useAction } from "next-safe-action/hooks";

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
    description: "Médica especializada em gestação e parto",
    icon: Stethoscope,
  },
  {
    type: "enfermeiro",
    label: "Enfermeira",
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
  const { execute, status } = useAction(setProfessionalTypeAction);

  const isPending = status === "executing";

  function handleSelect(type: ProfessionalType) {
    execute({ type });
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-poppins font-semibold text-2xl tracking-tight">Qual é o seu perfil?</h1>
        <p className="mt-2 text-muted-foreground text-sm">
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
                <p className="font-medium text-sm">{label}</p>
                <p className="mt-1 text-muted-foreground text-xs">{description}</p>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
