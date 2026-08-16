"use client";

import { sanitizeMessageHtml } from "@/lib/contract-message-html";
import { cn } from "@/lib/utils";
import type { ContractChangeRequestWithContract, ContractListItem } from "@/services/patient-self";
import { Badge } from "@ventre/ui/badge";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import dayjs from "dayjs";
import { Check, Clock, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function SignatureStatusBadge({ label, signed }: { label: string; signed: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        variant="outline"
        className={cn(
          "gap-1",
          signed
            ? "border-green-500 bg-green-500 text-white"
            : "border-amber-500 bg-amber-500 text-white",
        )}
      >
        {signed ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {signed ? "Assinado" : "Pendente"}
      </Badge>
    </div>
  );
}

export default function ContractList({
  contracts,
  changeRequests,
}: {
  contracts: ContractListItem[];
  changeRequests: ContractChangeRequestWithContract[];
}) {
  const [selectedRequest, setSelectedRequest] = useState<ContractChangeRequestWithContract | null>(
    null,
  );

  if (contracts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-muted-foreground text-sm shadow-sm">
        Nenhum contrato disponível.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {contracts.map((contract) => {
          const pendingRequest = changeRequests.find(
            (request) => request.contract?.id === contract.id && request.status === "pending",
          );

          return (
            <Link
              key={contract.id}
              href={`/contrato/${contract.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition-colors hover:border-primary"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[#433831]">{contract.title}</p>
                  <p className="text-muted-foreground text-sm">
                    Criado em {dayjs(contract.created_at).format("DD/MM/YYYY")}
                  </p>
                </div>
                <div className="flex items-start gap-1.5 sm:shrink-0 sm:gap-4">
                  {pendingRequest && (
                    <Badge
                      variant="outline"
                      className="w-fit cursor-pointer border-blue-400/40 text-blue-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedRequest(pendingRequest);
                      }}
                    >
                      <MessageSquareText className="mr-1 h-3 w-3" />
                      Alteração solicitada
                    </Badge>
                  )}
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="pr-2 font-medium text-sm">Assinaturas</span>
                    <SignatureStatusBadge label="Minha" signed={contract.patientSigned} />
                    <SignatureStatusBadge
                      label="Empresa/Profissional"
                      signed={contract.is_signed}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

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
    </>
  );
}
