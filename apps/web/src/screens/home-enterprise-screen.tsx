"use client";

import { getActivityLogsAction } from "@/actions/get-activity-logs-action";
import { getHomeEnterpriseDataAction } from "@/actions/get-home-enterprise-data-action";
import { Header } from "@/components/layouts/header";
import { LastActivitiesSection } from "@/components/shared/last-activities-section";
import { PatientsDonutChart } from "@/components/shared/patients-donut-chart";
import { TrimesterSemiChart } from "@/components/shared/trimester-semi-chart";
import { isStaff } from "@/lib/access-control";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { cn } from "@/lib/utils";
import AddEnterpriseProfessionalModal from "@/modals/add-enterprise-professional-modal";
import NewPatientModal from "@/modals/new-patient-modal";
import type { ActivityLog } from "@/services/activity-logs";
import type { EnterpriseAppointment, EnterpriseProfessional } from "@/services/home-enterprise";
import { getFirstName } from "@/utils";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ventre/ui/card";
import { Skeleton } from "@ventre/ui/skeleton";
import {
  Baby,
  BriefcaseMedicalIcon,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type HomeEnterpriseScreenProps = {
  profile: Tables<"users">;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

type QuickActionProps = {
  icon: React.ElementType;
  label: string;
} & ({ onClick: () => void } | { href: string });

function QuickActionCard({ icon: Icon, label, ...rest }: QuickActionProps) {
  const inner = (
    <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
      <CardContent className="flex flex-col items-center gap-2 px-3 py-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-center font-medium text-xs leading-tight">{label}</span>
      </CardContent>
    </Card>
  );

  if ("href" in rest) {
    return <Link href={rest.href}>{inner}</Link>;
  }

  return (
    <button type="button" className="text-left" onClick={rest.onClick}>
      {inner}
    </button>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function HomeEnterpriseScreenSkeleton({ profile }: { profile: Tables<"users"> }) {
  return (
    <div className="flex h-full flex-col">
      <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col items-center gap-2 px-3 py-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Row 1: TrimesterSemiChart + LastActivitiesSection */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-1">
            <CardHeader className="p-4">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Skeleton className="h-[160px] w-full rounded-lg" />
              <div className="flex flex-wrap justify-center gap-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="p-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1.5 pl-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: PatientsDonutChart + AppointmentTimeline */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-1">
            <CardHeader className="p-4">
              <Skeleton className="h-5 w-52" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-[240px] w-full rounded-lg" />
              <div className="flex flex-wrap justify-center gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-5 w-28" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit p-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1.5 pl-4">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="relative flex gap-3 pb-6 last:pb-0">
                    <div className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                      <Skeleton className="h-3 w-3 rounded-full" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-44" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Appointment Timeline ─────────────────────────────────────────────────────

function AppointmentTimeline({ appointments }: { appointments: EnterpriseAppointment[] }) {
  const today = dayjs().format("YYYY-MM-DD");

  function formatDate(date: string) {
    if (date === today) return "Hoje";
    return dayjs(date).format("DD MMM");
  }

  function getTypeLabel(type: string, dum: string | null | undefined) {
    const gestAge = calculateGestationalAge(dum ?? null);
    const weeksLabel = gestAge ? ` (${gestAge.weeks} sem)` : "";
    return type === "consulta" ? `Consulta Pré-natal${weeksLabel}` : "Encontro Preparatório";
  }

  return (
    <Card className="h-fit p-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1.5 pl-4">
        <CardTitle>Agenda</CardTitle>
        <Button size="icon" variant="outline" asChild>
          <Link href="/appointments">
            <CalendarDays className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="bg-background">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma consulta agendada.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {appointments.map((appt, index) => (
              <div key={appt.id} className="relative flex gap-3 pb-6 last:pb-0">
                {index < appointments.length - 1 && (
                  <div className="absolute top-5 left-[9px] h-[calc(100%-12px)] w-px bg-border" />
                )}
                <div className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      appt.date === today
                        ? "border-primary bg-primary/20"
                        : "border-muted-foreground/40 bg-background"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium text-xs ${
                      appt.date === today ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {formatDate(appt.date)}, {appt.time.slice(0, 5)}
                  </p>
                  <p className="font-medium text-sm">{appt.patient.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {getTypeLabel(appt.type, appt.patient.pregnancies?.[0]?.dum)}
                  </p>
                  <p className="text-muted-foreground text-xs">com {appt.professional.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeEnterpriseScreen({ profile }: HomeEnterpriseScreenProps) {
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showNewProfessional, setShowNewProfessional] = useState(false);

  const {
    execute: fetchHomeData,
    result: homeDataResult,
    isPending: isLoadingHome,
  } = useAction(getHomeEnterpriseDataAction);

  const {
    execute: fetchActivityLogs,
    result: activityLogsResult,
    isPending: isLoadingLogs,
  } = useAction(getActivityLogsAction);

  // biome-ignore lint/correctness/useExhaustiveDependencies: running on mount
  useEffect(() => {
    fetchHomeData({});
    if (isStaff(profile)) fetchActivityLogs({});
  }, []);

  const homeData = homeDataResult.data;
  const upcomingAppointments = homeData?.upcomingAppointments ?? [];
  const professionals = (homeData?.professionals ?? []) as EnterpriseProfessional[];
  const trimesterCounts = homeData?.trimesterCounts ?? { first: 0, second: 0, third: 0 };
  const allPatientIds = homeData?.allPatientIds ?? [];

  const refreshAll = useCallback(() => {
    fetchHomeData({});
    if (isStaff(profile)) fetchActivityLogs({});
  }, [fetchHomeData, fetchActivityLogs, profile]);

  if (isLoadingHome && !homeData) {
    return <HomeEnterpriseScreenSkeleton profile={profile} />;
  }

  const hasAnyPatients = allPatientIds.length > 0;

  return (
    <div className="flex h-full flex-col">
      <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />

      <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickActionCard
            icon={BriefcaseMedicalIcon}
            label="Nova Profissional"
            onClick={() => setShowNewProfessional(true)}
          />
          <QuickActionCard
            icon={Baby}
            label="Nova Gestante"
            onClick={() => setShowNewPatient(true)}
          />
          <QuickActionCard icon={CalendarPlus} label="Nova Agenda" href="/appointments" />
          <QuickActionCard icon={CircleDollarSign} label="Nova Cobrança" href="/billing" />
        </div>

        {hasAnyPatients ? (
          <>
            {/* Charts + Agenda */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TrimesterSemiChart trimesterCounts={trimesterCounts} total={allPatientIds.length} />
              <LastActivitiesSection
                logs={(activityLogsResult.data?.logs ?? []) as ActivityLog[]}
                isLoading={isLoadingLogs}
              />
            </div>

            {/* Professionals Distribution + Last Activities */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className={cn("p-1", !isStaff(profile) ? "lg:col-span-2" : "")}>
                <CardHeader className="p-4">
                  <CardTitle>Gestantes por Profissional</CardTitle>
                </CardHeader>
                <CardContent className="bg-background">
                  <PatientsDonutChart professionals={professionals} />
                </CardContent>
              </Card>
              <AppointmentTimeline appointments={upcomingAppointments} />
            </div>
          </>
        ) : homeData ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
            <Baby className="h-14 w-14 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-lg">Nenhuma gestante cadastrada</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Os profissionais da organização ainda não possuem gestantes associadas.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <AddEnterpriseProfessionalModal
        showModal={showNewProfessional}
        setShowModal={setShowNewProfessional}
        onSuccess={refreshAll}
      />
      <NewPatientModal
        showModal={showNewPatient}
        setShowModal={setShowNewPatient}
        professionals={professionals}
        onSuccess={refreshAll}
      />
    </div>
  );
}
