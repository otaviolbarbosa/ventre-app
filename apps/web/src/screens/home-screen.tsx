"use client";

import { PatientCard } from "@/components/shared/patient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { cn } from "@/lib/utils";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import NewPatientModal from "@/modals/new-patient-modal";
import type { HomeAppointment, HomeData } from "@/services/home";
import type { PatientWithGestationalInfo } from "@/types";
import { getFirstName } from "@/utils";
import type { Tables } from "@nascere/supabase";
import {
  Activity,
  Baby,
  Bell,
  Check,
  Eye,
  Heart,
  ListFilter,
  Plus,
  Search,
  SmilePlus,
  X,
} from "lucide-react";
import { redirect } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type HomeScreenProps = {
  profile: Tables<"users">;
  homeData: HomeData;
};

type FilterType = "all" | "final" | "recent" | "trim1" | "trim2" | "trim3";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatTodayDate() {
  return dayjs().format("[Hoje, ]DD [de] MMMM [de] YYYY");
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

function AppointmentTimeline({
  appointments,
  onNewAppointment,
}: { appointments: HomeAppointment[]; onNewAppointment: () => void }) {
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

  const handleOpenAppointments = () => {
    redirect("/appointments");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-poppins font-semibold text-xl">Próximos Encontros</h2>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={handleOpenAppointments}>
            <Eye />
            {/* Agendar consulta */}
          </Button>
          <Button
            size="icon"
            // variant="outline"
            onClick={onNewAppointment}
            className="gradient-primary"
          >
            <Plus />
            {/* Agendar consulta */}
          </Button>
        </div>
      </div>
      <Card className="h-fit">
        <CardContent className="space-y-4 p-5">
          {/* <div className="mb-4 flex items-center justify-between">
            <h3 className="font-poppins font-semibold text-lg leading-tight">Próximos Encontros</h3>
            <Link
              href="/appointments"
              className="font-semibold text-primary text-xs uppercase tracking-wide hover:underline"
            >
              Ver todos
            </Link>
          </div> */}

          {appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-muted-foreground text-sm">Sua agenda está livre.</p>
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
                      {getTypeLabel(appointment.type, appointment.patient.dum)}
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

export default function HomeScreen({ profile, homeData }: HomeScreenProps) {
  const { trimesterCounts, patients: initialPatients, upcomingAppointments } = homeData;

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<PatientWithGestationalInfo[]>(initialPatients);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const fetchPatients = useCallback(async (filter: FilterType, search: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (search) params.set("search", search);
      const response = await fetch(`/api/home/patients?${params}`);
      const data = await response.json();
      setPatients(data.patients || []);
    } catch {
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const handleFilterToggle = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        setSearchQuery("");
        fetchPatients(activeFilter, "");
      } else {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return !prev;
    });
  }, [activeFilter, fetchPatients]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setShowFilters(false);
    fetchPatients(filter, searchQuery);
  };

  const activeLabel = FILTER_LABELS[activeFilter];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchPatients(activeFilter, value);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-2 md:px-8">
        <div>
          <h1 className="font-poppins font-semibold text-2xl tracking-tight md:text-xl">
            {getGreeting()}, {getFirstName(profile.name)}!
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">{formatTodayDate()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col space-y-6 px-4 pt-4 pb-28 sm:pb-4 md:px-8">
        {/* Trimester Cards */}
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
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

        {/* Main Content: Two columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Patient List */}
          <div className="space-y-4">
            {/* Title + Filters */}
            <div className="flex items-center justify-between">
              <h2 className="font-poppins font-semibold text-xl">Minhas Gestantes</h2>
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
                  className="gradient-primary hidden gap-2 md:flex"
                  onClick={() => setShowNewPatient(true)}
                >
                  <Plus className="h-4 w-4" />
                  Nova Gestante
                </Button>
                {/* Mobile: only + icon */}
                <Button
                  className="gradient-primary md:hidden"
                  size="icon"
                  onClick={() => setShowNewPatient(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant={showSearch ? "secondary" : "outline"}
                  onClick={handleSearchToggle}
                >
                  {showSearch ? <X className="size-4" /> : <Search className="size-4" />}
                </Button>
                <div ref={filterRef} className="relative">
                  <Button
                    size="icon"
                    variant={activeFilter !== "all" ? "secondary" : "outline"}
                    onClick={handleFilterToggle}
                  >
                    <ListFilter className="size-4" />
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

            {/* Search */}
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

            {/* Patient List */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
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
                  patients.map((patient) => <PatientCard key={patient.id} patient={patient} />)
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
        callback={() => fetchPatients(activeFilter, searchQuery)}
      />
      <NewAppointmentModal
        patients={patients}
        showModal={showNewAppointment}
        setShowModal={setShowNewAppointment}
      />
    </div>
  );
}
