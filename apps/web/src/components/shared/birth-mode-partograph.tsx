"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BIRTH_EVENT_CONFIG, type BirthEventType } from "@/lib/birth-mode-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@ventre/ui/card";

type PartographSessionId =
  | "dilation_station"
  | "fetal_heart_rate"
  | "contraction"
  | "oxytocin"
  | "medication"
  | "membrane_rupture"
  | "maternal_vitals"
  | "urine_test";

const BIRTH_PARTOGRAPH_SESSIONS: {
  id: PartographSessionId;
  title: string;
  eventTypes: BirthEventType[];
  configType: BirthEventType;
}[] = [
  {
    id: "dilation_station",
    title: "Dilatação Cervical & Estação Fetal",
    eventTypes: ["cervical_dilation", "fetal_station"],
    configType: "cervical_dilation",
  },
  {
    id: "fetal_heart_rate",
    title: "Frequência Cardíaca Fetal (BCF)",
    eventTypes: ["fetal_heart_rate"],
    configType: "fetal_heart_rate",
  },
  {
    id: "contraction",
    title: "Contrações",
    eventTypes: ["contraction"],
    configType: "contraction",
  },
  {
    id: "oxytocin",
    title: "Ocitocina",
    eventTypes: ["medication"],
    configType: "medication",
  },
  {
    id: "medication",
    title: "Medicações",
    eventTypes: ["medication"],
    configType: "medication",
  },
  {
    id: "membrane_rupture",
    title: "Bolsa Rota & Líquido Amniótico",
    eventTypes: ["membrane_rupture", "amniotic_fluid"],
    configType: "membrane_rupture",
  },
  {
    id: "maternal_vitals",
    title: "Vitais Maternos",
    eventTypes: ["maternal_vitals"],
    configType: "maternal_vitals",
  },
  {
    id: "urine_test",
    title: "Urina",
    eventTypes: ["urine_test"],
    configType: "urine_test",
  },
];

type BirthModePartographProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModePartograph({ events }: BirthModePartographProps) {
  return (
    <div className="space-y-3">
      {BIRTH_PARTOGRAPH_SESSIONS.map((session) => {
        const config = BIRTH_EVENT_CONFIG[session.configType];
        const Icon = config.icon;
        const count = events.filter((event) =>
          session.eventTypes.includes(event.type),
        ).length;

        return (
          <Card key={session.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className={`h-4 w-4 ${config.colorClass}`} />
                {session.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
                Gráfico em breve
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                {count} registro{count === 1 ? "" : "s"} aguardando gráfico
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
