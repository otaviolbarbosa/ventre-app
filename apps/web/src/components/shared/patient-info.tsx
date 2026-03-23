"use client";
import type { Tables } from "@nascere/supabase";
import dayjs from "dayjs";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import InfoItem from "./info-item";
import { EditPatientModal } from "@/modals/edit-patient-modal";

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

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoItem label="CEP" value={patient.zipcode} />
        <InfoItem label="Estado" value={patient.state} />
        <InfoItem label="Cidade" value={patient.city} />
      </div>

      <InfoItem label="Rua" value={patient.street} />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoItem label="Número" value={patient.number} />
        <InfoItem label="Complemento" value={patient.complement} />
        <InfoItem label="Bairro" value={patient.neighborhood} />
      </div>

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
    </>
  );
}
