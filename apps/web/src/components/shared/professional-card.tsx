"use client";

import type { EnterpriseProfessional } from "@/services/professional";
import { Button } from "@ventre/ui/button";
import { Card } from "@ventre/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ventre/ui/dropdown-menu";
import { Separator } from "@ventre/ui/separator";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import {
  CalendarPlus,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  Stethoscope,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeira",
  doula: "Doula",
};

type ProfessionalCardProps = {
  professional: EnterpriseProfessional;
  onAddPatient: () => void;
  onAddCalendarEvent: () => void;
  onRemove: (professional: EnterpriseProfessional) => void;
};

export function ProfessionalCard({
  professional,
  onAddPatient,
  onAddCalendarEvent,
  onRemove,
}: ProfessionalCardProps) {
  const typeLabel = professional.professional_type
    ? (PROFESSIONAL_TYPE_LABELS[professional.professional_type] ?? professional.professional_type)
    : null;

  return (
    <Card className="flex flex-col overflow-hidden border-primary/25">
      {/* Header */}
      <div className="relative flex justify-end rounded-t-xl bg-muted/50 px-4 py-3">
        <div className="absolute top-5 left-4 flex items-center gap-2">
          <UserAvatar
            user={professional as { name: string; avatar_url: string | null }}
            size={16}
            className="bg-white p-1"
          />
        </div>

        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl bg-white shadow-sm"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  return;
                }}
              >
                <Search className="mr-2 size-4" />
                Ver Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddPatient}>
                <UserPlus className="mr-2 size-4" />
                Adicionar Gestante
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddCalendarEvent}>
                <CalendarPlus className="mr-2 size-4" />
                Adicionar Evento
              </DropdownMenuItem>
              <Separator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRemove(professional)}
              >
                <UserMinus className="mr-2 size-4" />
                Remover da organização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between gap-4 px-4 pt-10 pb-4">
        {/* Name & type */}
        <div>
          <p className="font-semibold leading-tight">{professional.name ?? "—"}</p>
          {typeLabel && <p className="mt-0.5 text-muted-foreground text-xs">{typeLabel}</p>}
        </div>

        {/* Contact rows */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
              <Phone className="size-3.5" />
            </div>
            <span className="text-sm">{professional.phone ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
              <Mail className="size-3.5" />
            </div>
            <span className="truncate text-sm">{professional.email ?? "—"}</span>
          </div>
        </div>

        {/* Patients link */}
        <Link
          href={`/patients?professional=${professional.id}`}
          className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5"
        >
          <Stethoscope className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 font-medium text-sm hover:text-primary">
            {professional.patient_count}{" "}
            {professional.patient_count === 1 ? "gestante" : "gestantes"}
          </div>
          <ChevronRight className="size-4 text-primary" />
          {/* <Badge variant="secondary" className="text-xs">
            Ver
          </Badge> */}
        </Link>
      </div>
    </Card>
  );
}
