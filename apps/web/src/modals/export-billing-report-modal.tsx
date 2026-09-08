"use client";

import { exportBillingReportAction } from "@/actions/export-billing-report-action";
import { dayjs } from "@/lib/dayjs";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type ExportFormat = "pdf" | "xlsx" | "csv";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

type ExportBillingReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: ExportFormat | null;
  defaultMonth: string;
};

export function ExportBillingReportModal({
  open,
  onOpenChange,
  format,
  defaultMonth,
}: ExportBillingReportModalProps) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  useEffect(() => {
    if (open) setSelectedMonth(defaultMonth);
  }, [open, defaultMonth]);

  const { execute, isPending } = useAction(exportBillingReportAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      const byteChars = atob(data.fileBase64);
      const byteNumbers = Array.from(byteChars, (c) => c.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName;
      link.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    },
  });

  if (!format) return null;

  const monthLabel = `${capitalize(dayjs(selectedMonth).format("MMMM"))} de ${dayjs(selectedMonth).format("YYYY")}`;

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Exportar relatório em ${FORMAT_LABELS[format]}`}
      description="Escolha o mês do relatório financeiro."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setSelectedMonth(dayjs(selectedMonth).subtract(1, "month").format("YYYY-MM"))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center font-medium">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedMonth(dayjs(selectedMonth).add(1, "month").format("YYYY-MM"))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          className="w-full"
          onClick={() => execute({ month: selectedMonth, format })}
          disabled={isPending}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Exportar
        </Button>
      </div>
    </ContentModal>
  );
}
