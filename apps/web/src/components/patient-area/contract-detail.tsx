"use client";

import { getDocumentDownloadUrlAction } from "@/actions/get-document-download-url-action";
import { previewContractPdfAction } from "@/actions/preview-contract-pdf-action";
import { signContractAsPatientAction } from "@/actions/sign-contract-as-patient-action";
import { RequestContractChangeDialog } from "@/components/shared/request-contract-change-dialog";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { sanitizeMessageHtml } from "@/lib/contract-message-html";
import { dayjs } from "@/lib/dayjs";
import type { Contract } from "@/services/patient-self";
import type { Tables } from "@ventre/supabase";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Check, Clock, Download, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PdfViewer = dynamic(() => import("@/components/shared/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <p className="text-muted-foreground text-sm">Carregando visualizador...</p>,
});

type PdfSource = { url: string } | { base64: string };

export default function ContractDetail({
  contract,
  changeRequests,
}: {
  contract: Contract;
  changeRequests: Tables<"contract_change_requests">[];
}) {
  const router = useRouter();
  const [selectedRequest, setSelectedRequest] = useState<Tables<"contract_change_requests"> | null>(
    null,
  );
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const isFullySigned = !!contract.fully_signed_at;
  const hasPendingChangeRequest = changeRequests.length > 0;

  const { execute, isExecuting } = useAction(signContractAsPatientAction, {
    onSuccess: () => {
      toast.success("Contrato assinado com sucesso.");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao assinar contrato. Tente novamente.");
    },
  });

  const { executeAsync: getDownloadUrl } = useAction(getDocumentDownloadUrlAction);
  const { executeAsync: previewContractPdfAsync } = useAction(previewContractPdfAction);

  const handleDownload = async () => {
    if (!contract.finalized_document_id) return;
    setIsDownloading(true);
    try {
      const res = await getDownloadUrl({ documentId: contract.finalized_document_id });
      if (res?.data?.url) {
        window.open(res.data.url, "_blank");
      } else {
        toast.error(res?.serverError ?? "Erro ao baixar contrato");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-fetch when the contract itself changes
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setPdfError(null);

      // Fully signed: always show the finalized document (both parties' stamps +
      // authentication certificate) — never the professional-only original.
      if (isFullySigned) {
        if (!contract.finalized_document_id) {
          setPdfError("Documento final ainda não está disponível.");
          return;
        }
        const res = await getDownloadUrl({ documentId: contract.finalized_document_id });
        if (cancelled) return;
        if (res?.data?.url) {
          setPdfSource({ url: res.data.url });
        } else {
          setPdfError(res?.serverError ?? "Erro ao carregar contrato");
        }
        return;
      }

      // Not (yet) fully signed: reuse the stored original PDF — generated whenever
      // the contract itself was generated, signed or not — never re-render.
      if (contract.original_document_id) {
        const res = await getDownloadUrl({ documentId: contract.original_document_id });
        if (cancelled) return;
        if (res?.data?.url) {
          setPdfSource({ url: res.data.url });
        } else {
          setPdfError(res?.serverError ?? "Erro ao carregar contrato");
        }
        return;
      }

      const headerBlocks = contract.parties_details as unknown as ContractHeaderBlocks | null;
      if (!headerBlocks) return;
      const res = await previewContractPdfAsync({
        headerBlocks,
        title: contract.title,
        clausesHtml: contract.clauses_html,
      });
      if (cancelled) return;
      if (res?.data?.pdfBase64) {
        setPdfSource({ base64: res.data.pdfBase64 });
      } else {
        setPdfError(res?.serverError ?? "Erro ao gerar pré-visualização do contrato");
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
    // router.refresh() after signing re-fetches the contract server-side and passes
    // down fresh props, but contract.id itself never changes — so the PDF to display
    // (original vs finalized vs live preview) is re-evaluated whenever any of the
    // fields that decision depends on changes, not just when the contract itself does.
  }, [contract.id, isFullySigned, contract.finalized_document_id, contract.original_document_id]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {isFullySigned && (
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm">
          <Check className="size-4 shrink-0" />
          <span>
            Assinado por ambas as partes em{" "}
            {new Date(contract.fully_signed_at as string).toLocaleDateString("pt-BR")}
            {contract.verification_code ? ` · Código ${contract.verification_code}` : ""}
          </span>
        </div>
      )}

      {hasPendingChangeRequest && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {changeRequests.map((request) => (
            <Badge
              key={request.id}
              variant="outline"
              className="cursor-pointer border-amber-400/40 text-amber-700"
              onClick={() => setSelectedRequest(request)}
            >
              <Clock className="mr-1 h-3 w-3" />
              Solicitação pendente
            </Badge>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pdfSource ? (
          <PdfViewer source={pdfSource} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground text-sm">
            {pdfError ?? "Carregando documento..."}
          </div>
        )}
      </div>

      {isFullySigned && (
        <div className="flex shrink-0 flex-row justify-end gap-2">
          <Button
            variant="outline"
            disabled={isDownloading || !contract.finalized_document_id}
            onClick={handleDownload}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {isDownloading ? "Baixando..." : "Baixar contrato"}
          </Button>
        </div>
      )}

      {!isFullySigned && !hasPendingChangeRequest && (
        <div className="flex shrink-0 flex-row justify-end gap-2">
          <RequestContractChangeDialog patientId={contract.patient_id as string} />
          <Button
            disabled={isExecuting}
            className="flex-1 sm:flex-none"
            onClick={() => execute({ patientId: contract.patient_id as string, consent: true })}
          >
            {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assinar contrato
          </Button>
        </div>
      )}

      <ContentModal
        open={selectedRequest !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRequest(null);
        }}
        title="Solicitação de alteração"
        description={
          selectedRequest
            ? `Enviada em ${dayjs(selectedRequest.created_at).format("DD/MM/YYYY")}`
            : undefined
        }
      >
        {selectedRequest && (
          <div
            className="prose-sm pt-2"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizado via sanitizeMessageHtml
            dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(selectedRequest.message_html) }}
          />
        )}
      </ContentModal>
    </div>
  );
}
