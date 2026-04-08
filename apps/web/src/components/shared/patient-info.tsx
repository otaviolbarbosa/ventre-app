"use client";
import { EditPatientModal } from "@/modals/edit-patient-modal";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import dayjs from "dayjs";
import { MapPinned, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import InfoItem from "./info-item";

type PatientInfoProps = {
  patient: Tables<"patients"> & {
    due_date?: string | null;
    dum?: string | null;
    observations?: string | null;
  };
  onChange: () => Promise<void>;
};

export default function PatientInfo({ patient, onChange }: PatientInfoProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const resolveGoogleMapsLink = useMemo(() => {
    const address = [
      patient.street,
      patient.number,
      patient.complement,
      patient.neighborhood,
      patient.city,
      patient.state,
      patient.zipcode,
    ]
      .filter(Boolean)
      .join(", ")
      .replaceAll(" ", "+");
    return `https://www.google.com/maps/search/${address}`;
  }, [patient]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Nome completo" value={patient.name} />
        <InfoItem
          label="Data de nascimento"
          value={patient.date_of_birth ? dayjs(patient.date_of_birth).format("DD/MM/YYYY") : null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Email" value={patient.email} />
        <InfoItem label="Telefone" value={patient.phone} />
      </div>

      <InfoItem label="Nome do parceiro" value={patient.partner_name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem
          label="Data prevista do parto (DPP)"
          value={patient.due_date ? dayjs(patient.due_date).format("DD/MM/YYYY") : null}
        />
        <InfoItem
          label="Data da última menstruação (DUM)"
          value={patient.dum ? dayjs(patient.dum).format("DD/MM/YYYY") : null}
        />
      </div>

      <InfoItem
        label="Endereço"
        value={
          <div className="flex justify-between gap-4">
            <div>
              <div>{[patient.street, patient.number].filter(Boolean).join(", ")}</div>
              <div>{patient.complement}</div>
              <div>{patient.neighborhood}</div>
              <div>{[patient.city, patient.state].filter(Boolean).join("-")}</div>
              <div>{patient.zipcode}</div>
            </div>
            {resolveGoogleMapsLink ? (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="-top-4 absolute right-0 hidden sm:flex"
                  onClick={() => setShowMapModal(true)}
                >
                  Navegar para o endereço
                  <MapPinned />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="-top-4 absolute right-0 flex sm:hidden"
                  onClick={() => setShowMapModal(true)}
                >
                  <MapPinned />
                </Button>
              </div>
            ) : null}
          </div>
        }
      />

      <InfoItem label="Observações" value={patient.observations} />

      <Button
        variant="outline"
        className="absolute top-0 right-0 hidden md:flex"
        onClick={(e) => {
          e.stopPropagation();
          setShowEditModal(true);
        }}
      >
        <Pencil className="h-4 w-4" />
        <span className="ml-2 block">Editar</span>
      </Button>

      <Button
        size="icon"
        variant="outline"
        className="absolute top-0 right-0 flex md:hidden"
        onClick={(e) => {
          e.stopPropagation();
          setShowEditModal(true);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <EditPatientModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        patient={patient}
        onSuccess={onChange}
      />

      <ContentModal
        open={showMapModal}
        onOpenChange={setShowMapModal}
        title="Endereço da gestante"
        description="Como deseja abrir o endereço?"
      >
        <div className="flex flex-col gap-3">
          <Button variant="outline" asChild>
            <a href={resolveGoogleMapsLink} target="_blank" rel="noreferrer">
              <MapPinned />
              Abrir no mapa
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Compartilhado pelo VentreApp: Este é o endereço de ${patient.name}: ${resolveGoogleMapsLink}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Compartilhar pelo WhatsApp
            </a>
          </Button>
        </div>
      </ContentModal>
    </>
  );
}
