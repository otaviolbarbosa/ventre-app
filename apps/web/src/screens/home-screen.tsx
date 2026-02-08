"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import NewPatientModal from "@/modals/new-patient-modal";
import type { HomeAppointment, HomeData, PatientWithGestationalInfo } from "@/services/home";
import { getFirstName, getInitials } from "@/utils";
import type { Tables } from "@nascere/supabase";
import { Activity, Baby, Bell, Heart, MoreHorizontal, Plus, Search, SmilePlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type HomeScreenProps = {
  profile: Tables<"users">;
  homeData: HomeData;
};

type FilterType = "all" | "final" | "recent";

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

function PatientCard({ patient }: { patient: PatientWithGestationalInfo }) {
  const dppFormatted = dayjs(patient.due_date).format("DD/MM/YYYY");
  const statusColor =
    patient.weeks >= 37 ? "bg-orange-400" : patient.weeks >= 28 ? "bg-blue-400" : "bg-green-400";

  return (
    <Link
      href={`/patients/${patient.id}`}
      className="flex items-center gap-4 border-b p-4 transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
        {getInitials(patient.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{patient.name}</h4>
          <button
            type="button"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        <p className="text-muted-foreground text-sm">
          DPP: {dppFormatted} &bull;{" "}
          <span className="text-rose-500">{patient.remainingDays} dias restantes</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
          <div className="relative flex-1 overflow-hidden rounded-full bg-muted p-0.5">
            <div
              className="inset-y-0 left-0 h-2 rounded-full bg-primary"
              style={{ width: `${patient.progress}%` }}
            />
          </div>
          <span className="text-muted-foreground text-xs">{patient.weeks} Semanas</span>
        </div>
      </div>
    </Link>
  );
}

function AppointmentTimeline({ appointments }: { appointments: HomeAppointment[] }) {
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
    <Card className="h-fit">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-poppins font-semibold text-lg leading-tight">
            Próximos
            <br />
            Encontros
          </h3>
          <Link
            href="/appointments"
            className="font-semibold text-primary text-xs uppercase tracking-wide hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {appointments.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">Nenhum encontro agendado</p>
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

        {/* <Link href="/appointments">
          <Button variant="outline" className="mt-4 w-full gap-2">
            <Calendar className="h-4 w-4" />
            Agendar Encontro
          </Button>
        </Link> */}
      </CardContent>
    </Card>
  );
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: "Todas",
  final: "Reta Final",
  recent: "Recentes",
};

export default function HomeScreen({ profile, homeData }: HomeScreenProps) {
  const { trimesterCounts, patients: initialPatients, upcomingAppointments } = homeData;

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<PatientWithGestationalInfo[]>(initialPatients);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    fetchPatients(filter, searchQuery);
  };

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
      iconBg: "bg-primary-50",
    },
    {
      label: "2º Trimestre",
      count: trimesterCounts.second,
      subtitle: "Acompanhamento regular",
      icon: Activity,
      iconColor: "text-primary",
      iconBg: "bg-primary-50",
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
          <h1 className="font-bold font-poppins text-2xl tracking-tight md:text-3xl">
            {getGreeting()}, {getFirstName(profile.name)}!
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">{formatTodayDate()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Bell className="h-5 w-5" />
          </Button>
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
        </div>
      </header>

      <div className="flex flex-1 flex-col space-y-6 px-4 pt-4 pb-20 sm:pb-4 md:px-8">
        {/* Trimester Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {trimesterCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-muted-foreground text-sm">{card.label}</p>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-poppins font-semibold text-xl">Minhas Gestantes</h2>
              <div className="flex rounded-full bg-gray-200/50 p-1">
                {(Object.keys(FILTER_LABELS) as FilterType[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => handleFilterChange(filter)}
                    className={`flex-1 whitespace-nowrap rounded-full px-4 py-1.5 font-medium text-sm transition-colors sm:inline ${
                      activeFilter === filter
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, data ou sintomas..."
                className="h-11 rounded-xl bg-white pl-10"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

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
            <AppointmentTimeline appointments={upcomingAppointments} />
          </div>
        </div>

        {/* Mobile: Upcoming Appointments */}
        <div className="lg:hidden">
          <AppointmentTimeline appointments={upcomingAppointments} />
        </div>
      </div>

      <NewPatientModal
        showModal={showNewPatient}
        setShowModal={setShowNewPatient}
        callback={() => fetchPatients(activeFilter, searchQuery)}
      />
    </div>
  );
}
