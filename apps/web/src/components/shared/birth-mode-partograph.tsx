"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BirthModeContractionChart } from "@/components/shared/birth-mode-contraction-chart";
import { BirthModeDilationStationChart } from "@/components/shared/birth-mode-dilation-station-chart";
import { BirthModeFetalHeartRateChart } from "@/components/shared/birth-mode-fetal-heart-rate-chart";
import { BirthModeMaternalVitalsChart } from "@/components/shared/birth-mode-maternal-vitals-chart";
import { BirthModeMedicationList } from "@/components/shared/birth-mode-medication-list";
import { BirthModeMembraneRuptureSummary } from "@/components/shared/birth-mode-membrane-rupture-summary";
import { BirthModeOxytocinChart } from "@/components/shared/birth-mode-oxytocin-chart";
import { BirthModeUrineTestChart } from "@/components/shared/birth-mode-urine-test-chart";
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
  configType: BirthEventType;
}[] = [
  {
    id: "dilation_station",
    title: "Dilatação Cervical & Estação Fetal",
    configType: "cervical_dilation",
  },
  {
    id: "fetal_heart_rate",
    title: "Frequência Cardíaca Fetal (BCF)",
    configType: "fetal_heart_rate",
  },
  {
    id: "contraction",
    title: "Contrações",
    configType: "contraction",
  },
  {
    id: "oxytocin",
    title: "Ocitocina",
    configType: "medication",
  },
  {
    id: "medication",
    title: "Medicações",
    configType: "medication",
  },
  {
    id: "membrane_rupture",
    title: "Bolsa Rota & Líquido Amniótico",
    configType: "membrane_rupture",
  },
  {
    id: "maternal_vitals",
    title: "Vitais Maternos",
    configType: "maternal_vitals",
  },
  {
    id: "urine_test",
    title: "Urina",
    configType: "urine_test",
  },
];

type BirthModePartographProps = {
  events: BirthModeTimelineEvent[];
};

function renderSessionContent(sessionId: PartographSessionId, events: BirthModeTimelineEvent[]) {
  switch (sessionId) {
    case "dilation_station":
      return <BirthModeDilationStationChart events={events} />;
    case "fetal_heart_rate":
      return <BirthModeFetalHeartRateChart events={events} />;
    case "contraction":
      return <BirthModeContractionChart events={events} />;
    case "oxytocin":
      return <BirthModeOxytocinChart events={events} />;
    case "medication":
      return <BirthModeMedicationList events={events} />;
    case "membrane_rupture":
      return <BirthModeMembraneRuptureSummary events={events} />;
    case "maternal_vitals":
      return <BirthModeMaternalVitalsChart events={events} />;
    case "urine_test":
      return <BirthModeUrineTestChart events={events} />;
  }
}

export function BirthModePartograph({ events }: BirthModePartographProps) {
  return (
    <div className="space-y-3">
      {BIRTH_PARTOGRAPH_SESSIONS.map((session) => {
        const config = BIRTH_EVENT_CONFIG[session.configType];
        const Icon = config.icon;

        return (
          <Card key={session.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className={`h-4 w-4 ${config.colorClass}`} />
                {session.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">{renderSessionContent(session.id, events)}</CardContent>
          </Card>
        );
      })}
    </div>
  );
}
