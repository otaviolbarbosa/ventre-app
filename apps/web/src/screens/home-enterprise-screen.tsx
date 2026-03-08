"use client";

import { getEnterpriseHomePatientsAction } from "@/actions/get-enterprise-home-patients-action";
import { Header } from "@/components/layouts/header";
import { PatientCard } from "@/components/shared/patient-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { cn } from "@/lib/utils";
import NewPatientModal from "@/modals/new-patient-modal";
import type { EnterpriseAppointment, HomeEnterpriseData } from "@/services/home-enterprise";
import type { PatientWithGestationalInfo } from "@/types";
import { getFirstName } from "@/utils";
import type { Tables } from "@nascere/supabase";
import {
  Activity,
  Baby,
  CalendarDays,
  Check,
  Heart,
  ListFilter,
  Search,
  SmilePlus,
  Stethoscope,
  UserPlusIcon,
  Users,
  X,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type HomeEnterpriseScreenProps = {
  profile: Tables<"users">;
  homeData: HomeEnterpriseData;
};

type FilterType = "all" | "final" | "recent" | "trim1" | "trim2" | "trim3";

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  obstetra: "Obstetra",
  enfermeiro: "Enfermeiro(a)",
  doula: "Doula",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function PatientCardSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b p-4 last:border-b-0">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="mt-2 h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

function AppointmentTimeline({ appointments }: { appointments: EnterpriseAppointment[] }) {
  const today = dayjs().format("YYYY-MM-DD");

  function formatAppointmentDate(date: string) {
    if (date === today) return "Hoje";
    return dayjs(date).format("DD MMM");
  }

  function getTypeLabel(type: string, dum: string | null) {
    const gestAge = calculateGestationalAge(dum);
    const weeksLabel = gestAge ? ` (${gestAge.weeks} sem)` : "";
    if (type === "consulta") return `Consulta Pré-natal${weeksLabel}`;
    return "Encontro Preparatório";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-poppins font-semibold text-xl">Agenda</h2>
        <Button size="icon" variant="outline" onClick={() => redirect("/appointments")}>
          <CalendarDays />
        </Button>
      </div>
      <Card className="h-fit">
        <CardContent className="space-y-4">
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma consulta agendada.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {appointments.map((appointment, index) => (
                <div key={appointment.id} className="relative flex gap-3 pb-6 last:pb-0">
                  {index < appointments.length - 1 && (
                    <div className="absolute top-5 left-[9px] h-[calc(100%-12px)] w-px bg-border" />
                  )}
                  <div className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                    <div
                      className={`h-3 w-3 rounded-full border-2 ${
                        appointment.date === today
                          ? "border-primary bg-primary/20"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    />
                  </div>
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
                      {getTypeLabel(appointment.type, appointment.patient.dum)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      com {appointment.professional.name}
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

export default function HomeEnterpriseScreen({ profile, homeData }: HomeEnterpriseScreenProps) {
  const { trimesterCounts, upcomingAppointments, professionals } = homeData;

  const [showNewPatient, setShowNewPatient] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const {
    execute: fetchPatients,
    result: patientsResult,
    isPending: isLoading,
  } = useAction(getEnterpriseHomePatientsAction);

  const patients = (patientsResult.data?.patients ??
    homeData.patients) as PatientWithGestationalInfo[];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to add fetchPatients on deps
  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        setSearchQuery("");
        fetchPatients({ filter: activeFilter, search: "" });
      } else {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return !prev;
    });
  }, [activeFilter]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setShowFilters(false);
    fetchPatients({ filter, search: searchQuery });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchPatients({ filter: activeFilter, search: value });
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const activeLabel = FILTER_LABELS[activeFilter];

  const trimesterCards = [
    {
      label: "1º Trimestre",
      count: trimesterCounts.first,
      subtitle: "Gestantes ativas",
      icon: SmilePlus,
      iconColor: "text-primary",
      iconBg: "bg-muted",
    },
    {
      label: "2º Trimestre",
      count: trimesterCounts.second,
      subtitle: "Acompanhamento regular",
      icon: Activity,
      iconColor: "text-primary",
      iconBg: "bg-muted",
    },
    {
      label: "3º Trimestre",
      count: trimesterCounts.third,
      subtitle: "Preparação para parto",
      icon: Heart,
      iconColor: "text-rose-500",
      iconBg: "bg-rose-50",
    },
  ];

  const hasAnyPatients = homeData.allPatientIds.length > 0;

  if (!hasAnyPatients) {
    return (
      <div className="flex h-full flex-col">
        <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Baby className="h-14 w-14 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-lg">Nenhuma gestante cadastrada</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Os profissionais da organização ainda não possuem gestantes associadas.
            </p>
          </div>
          {professionals.length > 0 && (
            <Button className="gradient-primary mt-2" onClick={() => setShowNewPatient(true)}>
              <UserPlusIcon />
              Adicionar Gestante
            </Button>
          )}
        </div>
        <NewPatientModal
          showModal={showNewPatient}
          setShowModal={setShowNewPatient}
          professionals={professionals}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={`${getGreeting()}, ${getFirstName(profile.name)}!`} />

      <div className="flex flex-1 flex-col space-y-4 px-4 pt-0 pb-28 sm:pb-4 md:px-6">
        {/* Trimester Cards */}
        <div className="-mx-4 no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {trimesterCards.map((card) => (
            <Card key={card.label} className="w-52 shrink-0 sm:w-auto">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-muted-foreground text-sm">{card.label}</p>
                  <p className="font-bold font-poppins text-3xl">{card.count}</p>
                  <p className="text-muted-foreground text-xs">{card.subtitle}</p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${card.iconBg}`}
                >
                  <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Professionals + Patient List */}
          <div className="space-y-6">
            {/* Professionals */}
            {professionals.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-poppins font-semibold text-xl">Profissionais</h2>
                </div>
                <div className="-mx-4 no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {professionals.map((prof) => (
                    <Card key={prof.id} className="w-44 shrink-0 sm:w-auto">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(prof.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">{prof.name ?? "—"}</p>
                          <p className="text-muted-foreground text-xs">
                            {prof.professional_type
                              ? (PROFESSIONAL_TYPE_LABELS[prof.professional_type] ??
                                prof.professional_type)
                              : "Profissional"}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            <Stethoscope className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground text-xs">
                              {prof.patient_count}{" "}
                              {prof.patient_count === 1 ? "gestante" : "gestantes"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Patient List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-poppins font-semibold text-xl">Gestantes</h2>
                <div className="flex items-center gap-2">
                  {activeFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
                      {activeLabel}
                      <button type="button" onClick={() => handleFilterChange("all")}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )}

                  <Button
                    size="icon"
                    variant={showSearch ? "secondary" : "outline"}
                    onClick={handleSearchToggle}
                  >
                    {showSearch ? <X /> : <Search />}
                  </Button>
                  <div ref={filterRef} className="relative">
                    <Button
                      size="icon"
                      variant={activeFilter !== "all" ? "secondary" : "outline"}
                      onClick={() => setShowFilters((prev) => !prev)}
                    >
                      <ListFilter />
                    </Button>
                    <div
                      className={cn(
                        "absolute top-full right-0 z-10 mt-2 flex flex-col gap-1.5 rounded-xl border bg-background p-2 shadow-md transition-opacity duration-200",
                        showFilters ? "opacity-100" : "pointer-events-none opacity-0",
                      )}
                    >
                      {(Object.keys(FILTER_LABELS) as FilterType[]).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => handleFilterChange(filter)}
                          className={cn(
                            "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                            activeFilter === filter && "font-medium text-primary",
                          )}
                        >
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              activeFilter === filter ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {FILTER_LABELS[filter]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {showSearch && (
                <div className="relative">
                  <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Buscar por nome"
                    className="h-11 rounded-full bg-white pl-10"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              )}

              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <>
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
          </div>

          {/* Right: Agenda */}
          <div className="hidden lg:block">
            <AppointmentTimeline appointments={upcomingAppointments} />
          </div>
        </div>

        {/* Mobile: Agenda */}
        <div className="lg:hidden">
          <AppointmentTimeline appointments={upcomingAppointments} />
        </div>
      </div>
    </div>
  );
}
