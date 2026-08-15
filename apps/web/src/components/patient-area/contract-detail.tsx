"use client";

import { signContractAsPatientAction } from "@/actions/sign-contract-as-patient-action";
import { RequestContractChangeDialog } from "@/components/shared/request-contract-change-dialog";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { sanitizeClausesHtml } from "@/lib/contract-html";
import { sanitizeMessageHtml } from "@/lib/contract-message-html";
import { dayjs } from "@/lib/dayjs";
import type { Contract } from "@/services/patient-self";
import type { Tables } from "@ventre/supabase";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Check, Clock, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
  const isFullySigned = !!contract.fully_signed_at;
  const hasPendingChangeRequest = changeRequests.length > 0;
  const headerBlocks = contract.parties_details as unknown as ContractHeaderBlocks | null;

  const { execute, isExecuting } = useAction(signContractAsPatientAction, {
    onSuccess: () => {
      toast.success("Contrato assinado com sucesso.");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao assinar contrato. Tente novamente.");
    },
  });

  return (
    <div className="space-y-4">
      {isFullySigned && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm">
          <Check className="size-4 shrink-0" />
          <span>
            Assinado por ambas as partes em{" "}
            {new Date(contract.fully_signed_at as string).toLocaleDateString("pt-BR")}
            {contract.verification_code ? ` · Código ${contract.verification_code}` : ""}
          </span>
        </div>
      )}

      {hasPendingChangeRequest && (
        <div className="flex flex-wrap gap-2">
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

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {headerBlocks && (
          <>
            <div className="mb-4 border-gray-200 border-b pb-4 text-sm">
              <p className="font-semibold">CONTRATANTE:</p>
              <p className="mt-1 leading-relaxed">{headerBlocks.contratanteBlock}</p>
            </div>

            <div className="mb-4 border-gray-200 border-b pb-4 text-sm">
              <p className="font-semibold">CONTRATADA:</p>
              <p className="mt-1 leading-relaxed">{headerBlocks.contratadaBlock}</p>
            </div>

            {headerBlocks.teamMembersBlock && (
              <div className="mb-4 border-gray-200 border-b pb-4 text-sm">
                <p className="font-semibold">EQUIPE DE CUIDADO:</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {headerBlocks.teamMembersBlock}
                </p>
              </div>
            )}
          </>
        )}

        <div
          className="[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_h1]:mb-2 [&_h1]:font-bold [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizado via sanitizeClausesHtml
          dangerouslySetInnerHTML={{ __html: sanitizeClausesHtml(contract.clauses_html) }}
        />
      </div>

      {!isFullySigned && contract.is_signed && !hasPendingChangeRequest && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            disabled={isExecuting}
            onClick={() =>
              execute({ patientId: contract.patient_id as string, consent: true })
            }
          >
            {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assinar contrato
          </Button>
          <RequestContractChangeDialog patientId={contract.patient_id as string} />
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
