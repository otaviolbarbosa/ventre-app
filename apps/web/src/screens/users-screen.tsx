"use client";

import { getPatientsByProfessionalAction } from "@/actions/get-patients-by-professional-action";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProfessionalCard } from "@/components/shared/professional-card";
import { StaffCard } from "@/components/shared/staff-card";
import AddEnterpriseProfessionalModal from "@/modals/add-enterprise-professional-modal";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import NewPatientModal from "@/modals/new-patient-modal";
import RemoveEnterpriseProfessionalModal from "@/modals/remove-enterprise-professional-modal";
import type { EnterpriseStaffMember } from "@/services/enterprise-users";
import type { EnterpriseProfessional } from "@/services/professional";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";
import { BriefcaseMedical, Stethoscope, UserPlus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

type UsersScreenProps = {
  professionals: EnterpriseProfessional[];
  staff: EnterpriseStaffMember[];
};

type Patient = Tables<"patients">;

export default function UsersScreen({ professionals, staff }: UsersScreenProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [patients, setPatients] = useState<{ id: string; name: string }[]>();
  const [selectedProfessional, setSelectedProfessional] = useState<EnterpriseProfessional>();
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [professionalToRemove, setProfessionalToRemove] = useState<EnterpriseProfessional | null>(
    null,
  );

  const { executeAsync: executeFetchPatients } = useAction(getPatientsByProfessionalAction);

  const fetchPatients = async (professionalId: string) => {
    const { data: patientsData } = await executeFetchPatients({
      professionalId,
    });

    if (!patientsData) {
      toast("Erro ao carregar dados de pacientes");
    }

    setPatients(patientsData?.patients);
  };

  return (
    <div>
      <Header title="Profissionais" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              className="gradient-primary flex sm:hidden"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus className="size-4" />
            </Button>
            <Button
              className="gradient-primary hidden sm:flex"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus className="size-4" />
              Adicionar Profissional
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="professionals" className="mt-4">
          <TabsList className="mb-4 w-full max-w-xs">
            <TabsTrigger value="professionals">
              Profissionais
              {professionals.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                  {professionals.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="staff">
              Gestoras
              {staff.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                  {staff.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Profissionais */}
          <TabsContent value="professionals">
            {professionals.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="Nenhum profissional cadastrado"
                description="Adicione profissionais já cadastrados na plataforma pelo e-mail."
              >
                <Button onClick={() => setShowAddModal(true)}>
                  <UserPlus className="size-4" />
                  Adicionar Profissional
                </Button>
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {professionals.map((professional) => (
                  <ProfessionalCard
                    key={professional.id}
                    professional={professional}
                    onAddPatient={async () => {
                      await fetchPatients(professional.id);
                      setSelectedProfessional(professional);
                      setShowNewPatientModal(true);
                    }}
                    onAddCalendarEvent={() => setShowNewAppointmentModal(true)}
                    onRemove={setProfessionalToRemove}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Gestoras */}
          <TabsContent value="staff">
            {staff.length === 0 ? (
              <EmptyState
                icon={BriefcaseMedical}
                title="Nenhuma gestora cadastrado"
                description="Gestoras e secretárias da organização aparecerão aqui."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {staff.map((member) => (
                  <StaffCard key={member.id} member={member} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AddEnterpriseProfessionalModal showModal={showAddModal} setShowModal={setShowAddModal} />

      <RemoveEnterpriseProfessionalModal
        professional={professionalToRemove}
        showModal={!!professionalToRemove}
        setShowModal={(open) => !open && setProfessionalToRemove(null)}
      />

      <NewPatientModal
        showModal={showNewPatientModal}
        professional={selectedProfessional}
        setShowModal={setShowNewPatientModal}
      />

      <NewAppointmentModal
        patients={patients as Patient[]}
        showModal={showNewAppointmentModal}
        setShowModal={setShowNewAppointmentModal}
      />
    </div>
  );
}
