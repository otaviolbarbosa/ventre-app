"use client";

import type { BillingViewMode } from "@/hooks/use-billing-view-mode";
import { Skeleton } from "@ventre/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ventre/ui/table";

type BillingListSkeletonProps = {
  viewMode: BillingViewMode;
  rows?: number;
};

export function BillingListSkeleton({ viewMode, rows = 4 }: BillingListSkeletonProps) {
  if (viewMode === "table") {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gestante</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders sem dados reais, ordem nunca muda
              <TableRow key={`billing-skeleton-row-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders sem dados reais, ordem nunca muda
        <Skeleton key={`billing-skeleton-card-${i}`} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
