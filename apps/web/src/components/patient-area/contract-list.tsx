"use client";

import { sanitizeMessageHtml } from "@/lib/contract-message-html";
import type { Contract, ContractChangeRequestWithContract } from "@/services/patient-self";
import { Badge } from "@ventre/ui/badge";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import dayjs from "dayjs";
import { Check, Clock, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ContractList({
  contracts,
  changeRequests,
}: {
  contracts: Contract[];
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
          const isFullySigned = !!contract.fully_signed_at;
          const pendingRequest = changeRequests.find(
            (request) => request.contract?.id === contract.id && request.status === "pending",
          );

          return (
            <Link
              key={contract.id}
              href={`/contrato/${contract.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#433831]">{contract.title}</p>
                  <p className="text-muted-foreground text-sm">
                    Criado em {dayjs(contract.created_at).format("DD/MM/YYYY")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pendingRequest && (
                    <Badge
                      variant="outline"
                      className="cursor-pointer border-blue-400/40 text-blue-700"
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
                  {isFullySigned ? (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      <Check className="mr-1 h-3 w-3" />
                      Assinado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400/40 text-amber-700">
                      <Clock className="mr-1 h-3 w-3" />
                      Pendente
                    </Badge>
                  )}
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
