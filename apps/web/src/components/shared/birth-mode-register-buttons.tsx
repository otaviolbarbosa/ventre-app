"use client";

import {
  BIRTH_EVENT_CONFIG,
  BIRTH_EVENT_TYPES,
  type BirthEventType,
} from "@/lib/birth-mode-constants";
import { AddBirthAmnioticFluidRecordModal } from "@/modals/add-birth-amniotic-fluid-record-modal";
import { AddBirthCervicalDilationModal } from "@/modals/add-birth-cervical-dilation-modal";
import { AddBirthContractionModal } from "@/modals/add-birth-contraction-modal";
import { AddBirthFetalHeartRateModal } from "@/modals/add-birth-fetal-heart-rate-modal";
import { AddBirthFetalStationModal } from "@/modals/add-birth-fetal-station-modal";
import { AddBirthMedicationAdministrationModal } from "@/modals/add-birth-medication-administration-modal";
import { AddBirthMembraneRuptureModal } from "@/modals/add-birth-membrane-rupture-modal";
import { Button } from "@ventre/ui/button";
import { useState } from "react";

type BirthModeRegisterButtonsProps = {
  pregnancyId: string;
  onSuccess: () => void;
};

export function BirthModeRegisterButtons({
  pregnancyId,
  onSuccess,
}: BirthModeRegisterButtonsProps) {
  const [activeModal, setActiveModal] = useState<Exclude<
    BirthEventType,
    "start_monitoring"
  > | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {BIRTH_EVENT_TYPES.map(({ type }) => {
          const config = BIRTH_EVENT_CONFIG[type];
          const Icon = config.icon;
          return (
            <Button
              key={type}
              type="button"
              variant="ghost"
              onClick={() => setActiveModal(type)}
              asChild
            >
              <div className="h-auto flex-col gap-2 rounded-xl border py-4">
                <Icon className={`h-5 w-5 ${config.colorClass}`} />
                <span className="text-center text-xs">{config.label}</span>
              </div>
            </Button>
          );
        })}
      </div>

      <AddBirthContractionModal
        open={activeModal === "contraction"}
        onOpenChange={(open) => setActiveModal(open ? "contraction" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
      <AddBirthCervicalDilationModal
        open={activeModal === "cervical_dilation"}
        onOpenChange={(open) => setActiveModal(open ? "cervical_dilation" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
      <AddBirthFetalStationModal
        open={activeModal === "fetal_station"}
        onOpenChange={(open) => setActiveModal(open ? "fetal_station" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
      <AddBirthFetalHeartRateModal
        open={activeModal === "fetal_heart_rate"}
        onOpenChange={(open) => setActiveModal(open ? "fetal_heart_rate" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
      <AddBirthAmnioticFluidRecordModal
        open={activeModal === "amniotic_fluid"}
        onOpenChange={(open) => setActiveModal(open ? "amniotic_fluid" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
      <AddBirthMedicationAdministrationModal
        open={activeModal === "medication"}
        onOpenChange={(open) => setActiveModal(open ? "medication" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
      <AddBirthMembraneRuptureModal
        open={activeModal === "membrane_rupture"}
        onOpenChange={(open) => setActiveModal(open ? "membrane_rupture" : null)}
        pregnancyId={pregnancyId}
        onSuccess={onSuccess}
      />
    </>
  );
}
