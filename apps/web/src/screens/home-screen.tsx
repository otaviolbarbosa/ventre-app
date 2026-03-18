"use client";
import { getHomeDataAction } from "@/actions/get-home-data-action";
import { getHomePatientsAction } from "@/actions/get-home-patients-action";
import { getPatientsAction } from "@/actions/get-patients-action";
import { Header } from "@/components/layouts/header";
import { PatientCard } from "@/components/shared/patient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import NewPatientModal from "@/modals/new-patient-modal";
import { DppMonthCarousel } from "@/components/shared/dpp-month-carousel";
import { FilterDropdown } from "@/components/shared/filter-dropdown";
import type { HomeAppointment } from "@/services/home";
import { MONTH_LABELS_FULL } from "@/services/home";
import type { PatientFilter, PatientWithGestationalInfo } from "@/types";
import { getFirstName } from "@/utils";
import type { Tables } from "@nascere/supabase";
import { Baby, CalendarPlus, Eye, Search, UserPlusIcon, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type HomeScreenProps = {
  profile: Tables<"users">;
};

type FilterType = Exclude<PatientFilter, "finished">;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function PatientCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-2 h-3 w-full rounded-full" />
      </div>
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-20" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      <Card className="h-fit">
        <CardContent className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative flex gap-3 pb-6 last:pb-0">
              <div className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                <Skeleton className="h-3 w-3 rounded-full" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HomeScreenSkeleton({ profile }: { profile: Tables<"users"> }) {
  return (
    <div className="flex h-full flex-col">
      <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />
      <div className="flex flex-1 flex-col space-y-4 px-4 pt-0 pb-28 sm:pb-4 md:px-6">
        {/* DPP cards skeleton */}
        <div className="-mx-4 no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="shrink-0">
              <CardContent className="px-4 py-3">
                <div className="space-y-1">
                  <div className="flex min-w-[120px] items-center justify-between gap-3">
                    <Skeleton className="h-[28px] w-20" />
                    <Skeleton className="h-[25px] w-10 rounded-full" />
                  </div>
                  <div className="flex items-baseline gap-4">
                    <Skeleton className="h-[28px] w-6" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Patient list skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-44" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="hidden h-9 w-36 rounded-md md:block" />
                <Skeleton className="h-9 w-9 rounded-md md:hidden" />
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <PatientCardSkeleton />
                <PatientCardSkeleton />
                <PatientCardSkeleton />
                <PatientCardSkeleton />
                <PatientCardSkeleton />
              </CardContent>
            </Card>
          </div>

          {/* Agenda skeleton (desktop) */}
          <div className="hidden lg:block">
            <AgendaSkeleton />
          </div>
        </div>

        {/* Agenda skeleton (mobile) */}
        <div className="lg:hidden">
          <AgendaSkeleton />
        </div>
      </div>
    </div>
  );
}

function AppointmentTimeline({
  appointments,
  onNewAppointment,
}: { appointments: HomeAppointment[]; onNewAppointment: () => void }) {
  const router = useRouter();
  const today = dayjs().format("YYYY-MM-DD");

  function formatAppointmentDate(date: string) {
    if (date === today) return "Hoje";
    return dayjs(date).format("DD MMM");
  }

  function getTypeLabel(type: string, dum: string | null | undefined) {
    const gestAge = calculateGestationalAge(dum ?? null);
    const weeksLabel = gestAge ? ` (${gestAge.weeks} sem)` : "";
    if (type === "consulta") return `Consulta Pré-natal${weeksLabel}`;
    return "Encontro Preparatório";
  }

  const handleOpenAppointments = () => {
    router.push("/appointments");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-poppins font-semibold text-xl">Agenda</h2>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={handleOpenAppointments}>
            <Eye />
          </Button>
          <Button size="icon" onClick={onNewAppointment} className="gradient-primary">
            <CalendarPlus />
          </Button>
        </div>
      </div>
      <Card className="h-fit">
        <CardContent className="space-y-4">
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">Sua agenda está livre.</p>
              <p className="text-muted-foreground text-sm">
                Aproveite para adicionar um novo agendamento.
              </p>
              <Button className="gradient-primary mt-4" onClick={onNewAppointment}>
                <CalendarPlus />
                Novo Agendamento
              </Button>
            </div>
          ) : (
            <div className="space-y-0">
              {appointments.map((appointment, index) => (
                <div key={appointment.id} className="relative flex gap-3 pb-6 last:pb-0">
                  {/* Timeline line */}
                  {index < appointments.length - 1 && (
                    <div className="absolute top-5 left-[9px] h-[calc(100%-12px)] w-px bg-border" />
                  )}
                  {/* Timeline dot */}
                  <div className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    <div
                      className={`h-3 w-3 rounded-full border-2 ${
                        appointment.date === today
                          ? "border-primary bg-primary/20"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    />
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium text-xs ${
                        appointment.date === today ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {formatAppointmentDate(appointment.date)}, {appointment.time.slice(0, 5)}
                    </p>
                    <p className="font-medium text-sm">{appointment.patient.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {getTypeLabel(appointment.type, appointment.patient.pregnancies?.[0]?.dum)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: "Todas",
  recent: "Adicionadas Recentemente",
  trim1: "1º Trimestre",
  trim2: "2º Trimestre",
  trim3: "3º Trimestre",
  final: "Bebê a Termo",
};

type DppFilter = { month: number; year: number } | null;

export default function HomeScreen({ profile }: HomeScreenProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [dppFilter, setDppFilter] = useState<DppFilter>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    execute: fetchHomeData,
    result: homeDataResult,
    isPending: isLoadingHome,
  } = useAction(getHomeDataAction);

  const {
    execute: fetchPatients,
    result: patientsResult,
    isPending: isLoadingPatients,
  } = useAction(getHomePatientsAction);

  const { execute: fetchAllPatients, result: allPatientsResult } = useAction(getPatientsAction);

  useEffect(() => {
    fetchHomeData({});
    fetchAllPatients();
  }, [fetchHomeData, fetchAllPatients]);

  const homeData = homeDataResult.data;
  const dppByMonth = homeData?.dppByMonth ?? [];
  const upcomingAppointments = homeData?.upcomingAppointments ?? [];
  const patients = (patientsResult.data?.patients ??
    homeData?.patients ??
    []) as PatientWithGestationalInfo[];
  const allPatients = allPatientsResult.data?.patients ?? [];

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setDppFilter(null);
    fetchPatients({ filter, search: searchQuery });
  };

  const handleDppFilterChange = (month: number, year: number) => {
    const isSame = dppFilter?.month === month && dppFilter?.year === year;
    if (isSame) {
      setDppFilter(null);
      fetchPatients({ filter: activeFilter, search: searchQuery });
    } else {
      setDppFilter({ month, year });
      fetchPatients({ filter: activeFilter, search: searchQuery, dppMonth: month, dppYear: year });
    }
  };

  const handleClearDppFilter = () => {
    setDppFilter(null);
    fetchPatients({ filter: activeFilter, search: searchQuery });
  };

  const activeLabel = FILTER_LABELS[activeFilter];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchPatients({
        filter: activeFilter,
        search: value,
        ...(dppFilter ? { dppMonth: dppFilter.month, dppYear: dppFilter.year } : {}),
      });
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const refreshHomeData = useCallback(() => {
    fetchHomeData({});
  }, [fetchHomeData]);

  const refreshAll = useCallback(() => {
    fetchHomeData({});
    fetchPatients({ filter: activeFilter, search: searchQuery });
  }, [fetchHomeData, fetchPatients, activeFilter, searchQuery]);

  if (isLoadingHome || !homeData) {
    return <HomeScreenSkeleton profile={profile} />;
  }

  const hasAnyPatients = (homeData?.patients?.length ?? 0) > 0;

  if (!hasAnyPatients && homeData) {
    return (
      <div className="flex h-full flex-col">
        <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Baby className="h-14 w-14 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-lg">Nenhuma gestante cadastrada</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Adicione sua primeira gestante para começar o acompanhamento.
            </p>
          </div>
          <Button className="gradient-primary mt-2" onClick={() => setShowNewPatient(true)}>
            <UserPlusIcon />
            Adicionar Gestante
          </Button>
        </div>
        <NewPatientModal
          showModal={showNewPatient}
          setShowModal={setShowNewPatient}
          onSuccess={refreshAll}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />

      <div className="flex flex-1 flex-col space-y-4 px-4 pt-0 pb-28 sm:pb-4 md:px-6">
        {/* DPP by Month Cards */}
        <DppMonthCarousel
          items={dppByMonth}
          selectedMonth={dppFilter?.month ?? null}
          selectedYear={dppFilter?.year ?? null}
          onSelect={handleDppFilterChange}
        />

        {/* Main Content: Two columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Patient List */}
          <div className="space-y-4">
            {/* Title + Filters */}
            <div className="flex items-center justify-between">
              <h2 className="font-poppins font-semibold text-xl">Minhas Gestantes</h2>
              <div className="flex items-center gap-2">
                {dppFilter && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
                    {MONTH_LABELS_FULL[dppFilter.month]}
                    <button type="button" onClick={handleClearDppFilter}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
                {!dppFilter && activeFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
                    {activeLabel}
                    <button type="button" onClick={() => handleFilterChange("all")}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                <Button
                  className="gradient-primary hidden gap-2 md:flex"
                  onClick={() => setShowNewPatient(true)}
                >
                  <UserPlusIcon />
                  Nova Gestante
                </Button>
                <Button
                  className="gradient-primary md:hidden"
                  size="icon"
                  onClick={() => setShowNewPatient(true)}
                >
                  <UserPlusIcon />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar por nome"
                  className="rounded-full bg-white pl-10"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <FilterDropdown
                options={(Object.entries(FILTER_LABELS) as [FilterType, string][]).map(([value, label]) => ({ value, label }))}
                value={activeFilter}
                onChange={(v) => handleFilterChange(v as FilterType)}
              />
            </div>

            {/* Patient List */}
            <Card>
              <CardContent className="p-0">
                {isLoadingPatients ? (
                  <>
                    <PatientCardSkeleton />
                    <PatientCardSkeleton />
                    <PatientCardSkeleton />
                    <PatientCardSkeleton />
                    <PatientCardSkeleton />
                  </>
                ) : patients.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Baby className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground text-sm">Nenhuma gestante encontrada</p>
                  </div>
                ) : (
                  <div className="divider-y-1">
                    {patients.map((patient) => (
                      <Link key={patient.id} href={`/patients/${patient.id}`}>
                        <PatientCard patient={patient} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Upcoming Appointments */}
          <div className="hidden lg:block">
            <AppointmentTimeline
              appointments={upcomingAppointments}
              onNewAppointment={() => setShowNewAppointment(true)}
            />
          </div>
        </div>

        {/* Mobile: Upcoming Appointments */}
        <div className="lg:hidden">
          <AppointmentTimeline
            appointments={upcomingAppointments}
            onNewAppointment={() => setShowNewAppointment(true)}
          />
        </div>
      </div>

      <NewPatientModal
        showModal={showNewPatient}
        setShowModal={setShowNewPatient}
        onSuccess={refreshAll}
      />
      <NewAppointmentModal
        patients={allPatients}
        showModal={showNewAppointment}
        setShowModal={setShowNewAppointment}
        onSuccess={refreshHomeData}
      />
    </div>
  );
}
