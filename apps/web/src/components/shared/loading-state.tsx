import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((number) => (
          <Skeleton key={`loading-state-${number}`} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function LoadingTable() {
  return (
    <div className="rounded-lg border">
      <div className="divide-y">
        {Array.from({ length: 5 }).map((number) => (
          <div key={`loading-table-${number}`} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingPatientProfile() {
  return (
    <div className="space-y-6">
      <div className="w-full divide-y rounded-md border">
        {["informacoes", "prenatal", "documentos", "evolucao"].map((key) => (
          <div key={key} className="flex items-center justify-between px-4 py-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>

      {/* Delete button */}
      <Skeleton className="h-10 w-full sm:w-40" />
    </div>
  );
}

export function LoadingPatientAppointment() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-9 w-9 md:w-40" />
      </div>
      <div className="space-y-3">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-muted px-3 py-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingPatientTeam() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9 md:w-28" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {["a", "b", "c"].map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingPatientBilling() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
