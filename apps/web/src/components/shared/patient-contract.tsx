"use client";

import { deactivatePatientContractAction } from "@/actions/deactivate-patient-contract-action";
import { getDocumentDownloadUrlAction } from "@/actions/get-document-download-url-action";
import { getPatientContractAction } from "@/actions/get-patient-contract-action";
import { signPatientContractAction } from "@/actions/sign-patient-contract-action";
import { ContractSignaturePreview } from "@/components/shared/contract-signature-preview";
import { useAuth } from "@/hooks/use-auth";
import { isManager } from "@/lib/access-control";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { ESTADOS_BR } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { BadgeCheck, Download, Eye, FileText, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Mode = "loading" | "no-base" | "no-contract" | "choose-base" | "editing" | "readonly";

type BaseOption = {
  html: string;
  title: string;
  label: string;
  city: string | null;
  state: string | null;
};

type SignatureInfo = {
  signedAt: string | null;
  verificationCode: string | null;
  signedDocumentId: string | null;
  signedByName: string | null;
};

export default function PatientContract({
  patientId,
  pregnancyId,
}: {
  patientId: string;
  pregnancyId: string | null | undefined;
}) {
  const [mode, setMode] = useState<Mode>("loading");
  const [contractId, setContractId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [title, setTitle] = useState("CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
  const [clausesHtml, setClausesHtml] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [patientName, setPatientName] = useState<string | null>(null);
  const [contratadaName, setContratadaName] = useState<string | null>(null);
  const [baseHtml, setBaseHtml] = useState<string | null>(null);
  const [baseTitle, setBaseTitle] = useState<string | null>(null);
  const [baseOptions, setBaseOptions] = useState<BaseOption[]>([]);
  const [headerBlocks, setHeaderBlocks] = useState<ContractHeaderBlocks | null>(null);
  const [enterpriseHeaderBlocks, setEnterpriseHeaderBlocks] = useState<ContractHeaderBlocks | null>(
    null,
  );
  const [personalHeaderBlocks, setPersonalHeaderBlocks] = useState<ContractHeaderBlocks | null>(
    null,
  );
  const [savedParties, setSavedParties] = useState<ContractHeaderBlocks | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [contractExists, setContractExists] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [signatureInfo, setSignatureInfo] = useState<SignatureInfo | null>(null);

  const { profile } = useAuth();

  const { execute: fetchContract } = useAction(getPatientContractAction, {
    onSuccess: ({ data }) => {
      if (data?.headerBlocks) {
        setHeaderBlocks(data.headerBlocks);
        setEnterpriseHeaderBlocks(data.headerBlocks);
      }
      if (data?.personalHeaderBlocks) setPersonalHeaderBlocks(data.personalHeaderBlocks);
      setPatientName(data?.patientName ?? null);
      setContratadaName(data?.contratadaName ?? null);

      const options: BaseOption[] = [];
      if (data?.enterpriseBase) {
        options.push({
          html: data.enterpriseBase.html,
          title: data.enterpriseBase.title,
          label: "Contrato da empresa",
          city: data.enterpriseBase.city,
          state: data.enterpriseBase.state,
        });
      }
      if (data?.personalBase) {
        options.push({
          html: data.personalBase.html,
          title: data.personalBase.title,
          label: "Meu contrato pessoal",
          city: data.personalBase.city,
          state: data.personalBase.state,
        });
      }
      setBaseOptions(options);

      // Legacy fallback
      if (data?.baseContractHtml) setBaseHtml(data.baseContractHtml);
      if (data?.baseTitle) setBaseTitle(data.baseTitle);

      if (data?.contract) {
        setContractId(data.contract.id);
        setTitle(data.contract.title);
        setClausesHtml(data.contract.clauses_html);
        setCity(data.contract.city ?? "");
        setState(data.contract.state ?? "");
        if (data.savedParties) setSavedParties(data.savedParties);
        setSignatureInfo(
          data.contract.is_signed
            ? {
                signedAt: data.contract.signed_at,
                verificationCode: data.contract.verification_code,
                signedDocumentId: data.contract.signed_document_id,
                signedByName: data.signedByName ?? null,
              }
            : null,
        );
        setContractExists(true);
        setMode("readonly");
      } else if (options.length > 1) {
        setMode("choose-base");
      } else if (options.length === 1) {
        setMode("no-contract");
      } else {
        setMode("no-base");
      }
    },
    onError: () => setMode("no-base"),
  });

  const { execute: signContract, isExecuting: isSigning } = useAction(signPatientContractAction, {
    onSuccess: () => {
      toast.success("Contrato assinado com sucesso");
      setContractExists(true);
      setIsConsentOpen(false);
      setConsentChecked(false);
      // Reload to pick up the persisted parties_details, contract id and signature
      fetchContract({ patientId });
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao assinar contrato"),
  });

  const { executeAsync: getDownloadUrl } = useAction(getDocumentDownloadUrlAction);

  const { execute: deactivateContract, isExecuting: isDeactivating } = useAction(
    deactivatePatientContractAction,
    {
      onSuccess: () => {
        toast.success("Contrato excluído");
        setContractId(null);
        setContractExists(false);
        setSavedParties(null);
        setSignatureInfo(null);
        setIsDeleteConfirmOpen(false);
        setMode(baseOptions.length > 1 ? "choose-base" : "no-contract");
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao excluir contrato"),
    },
  );

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      // Signed contract: reuse the immutable signed PDF — never re-render
      if (signatureInfo?.signedDocumentId) {
        const res = await getDownloadUrl({ documentId: signatureInfo.signedDocumentId });
        if (res?.data?.url) {
          window.open(res.data.url, "_blank");
        } else {
          toast.error(res?.serverError ?? "Erro ao baixar contrato assinado");
        }
        return;
      }

      const res = await fetch(`/api/patients/${patientId}/contract/pdf`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao exportar PDF");
      } else {
        toast.success("PDF gerado com sucesso! Disponível em Documentos.");
        window.open(data.signedUrl, "_blank");
      }
    } finally {
      setIsExporting(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to add fetchContract
  useEffect(() => {
    fetchContract({ patientId });
  }, [patientId]);

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
        <span>Carregando contrato...</span>
      </div>
    );
  }

  if (mode === "no-base") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
        <p>Nenhum contrato base configurado.</p>
        <div className="mt-1 flex flex-col gap-1">
          {isManager(profile) && (
            <Link href="/settings/contract" className="underline">
              Configurar contrato da empresa →
            </Link>
          )}
          {!isManager(profile) && (
            <Link href="/profile/settings/contract" className="underline">
              Configurar meu contrato pessoal →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (mode === "choose-base") {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-muted-foreground text-sm">
          Escolha qual contrato base deseja usar para esta gestante:
        </p>
        <div className="flex flex-wrap gap-2">
          {baseOptions.map((opt) => {
            const isPersonal = opt.label === "Meu contrato pessoal";
            return (
              <Button
                key={opt.label}
                variant="outline"
                onClick={() => {
                  setTitle(opt.title);
                  setClausesHtml(opt.html);
                  setBaseHtml(opt.html);
                  setBaseTitle(opt.title);
                  setCity(opt.city ?? "");
                  setState(opt.state ?? "");
                  setHeaderBlocks(isPersonal ? personalHeaderBlocks : enterpriseHeaderBlocks);
                  setMode("editing");
                }}
              >
                <FileText className="mr-2 size-4" />
                {opt.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === "no-contract") {
    const base = baseOptions[0];
    const isPersonalOnly = base?.label === "Meu contrato pessoal";
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-muted-foreground text-sm">
          Nenhum contrato gerado para esta gestante ainda.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setTitle(base?.title ?? baseTitle ?? "CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
            setClausesHtml(base?.html ?? baseHtml ?? "");
            setCity(base?.city ?? "");
            setState(base?.state ?? "");
            if (isPersonalOnly) setHeaderBlocks(personalHeaderBlocks);
            setMode("editing");
          }}
        >
          <FileText className="mr-2 size-4" />
          Gerar contrato
        </Button>
      </div>
    );
  }

  if (mode === "readonly") {
    return (
      <>
        <div className="space-y-3 pt-2">
          {signatureInfo && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm">
              <BadgeCheck className="size-4 shrink-0" />
              <span>
                Assinado eletronicamente
                {signatureInfo.signedAt
                  ? ` em ${new Date(signatureInfo.signedAt).toLocaleDateString("pt-BR")}`
                  : ""}
                {signatureInfo.verificationCode
                  ? ` · Código ${signatureInfo.verificationCode}`
                  : ""}
              </span>
            </div>
          )}
          <ContractDocument
            headerBlocks={savedParties ?? headerBlocks}
            title={title}
            clausesHtml={clausesHtml}
          />
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Excluir contrato
            </Button>
            <div className="flex gap-2">
              {!signatureInfo && (
                <Button variant="outline" onClick={() => setMode("editing")}>
                  Editar contrato
                </Button>
              )}
              <Button variant="outline" disabled={isExporting} onClick={handleExportPdf}>
                <Download className="mr-2 size-4" />
                {isExporting ? "Gerando PDF..." : "Baixar contrato"}
              </Button>
            </div>
          </div>
        </div>

        <ContentModal
          open={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          title="Excluir contrato"
          description="O contrato não será apagado permanentemente. Você poderá gerar um novo contrato para esta gestante a qualquer momento."
          contentClassName="sm:max-w-[420px]"
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              disabled={isDeactivating}
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isDeactivating}
              onClick={() => {
                if (contractId) deactivateContract({ contractId, patientId });
              }}
            >
              {isDeactivating ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </div>
        </ContentModal>
      </>
    );
  }

  // editing mode
  return (
    <>
      <div className="space-y-3 px-0.5 pt-2">
        <div className="mb-6 space-y-2">
          <label htmlFor="contract-title" className="font-medium text-sm">
            Título do contrato
          </label>
          <Input
            id="contract-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do contrato"
          />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-2 sm:col-span-3">
            <label htmlFor="contract-city" className="font-medium text-sm">
              Cidade
            </label>
            <Input
              id="contract-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="contract-state" className="font-medium text-sm">
              Estado
            </label>
            <Select value={state || undefined} onValueChange={setState}>
              <SelectTrigger id="contract-state">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_BR.map((estado) => (
                  <SelectItem key={estado.sigla} value={estado.sigla}>
                    {estado.sigla}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ContractDocument headerBlocks={headerBlocks} clausesHtml={null}>
          <RichEditor
            content={clausesHtml}
            onChange={setClausesHtml}
            placeholder="Cláusulas do contrato..."
            className="max-h-[400px] min-h-[200px] bg-white"
          />
        </ContractDocument>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={isSigning}
            onClick={() =>
              setMode(
                contractExists
                  ? "readonly"
                  : baseOptions.length > 1
                    ? "choose-base"
                    : "no-contract",
              )
            }
          >
            Cancelar
          </Button>
          <Button variant="outline" disabled={isSigning} onClick={() => setIsPreviewOpen(true)}>
            <Eye className="mr-2 size-4" />
            Preview
          </Button>
          <Button
            className="gradient-primary"
            disabled={isSigning || isExporting}
            onClick={() => setIsConsentOpen(true)}
          >
            Gerar e assinar
          </Button>
        </div>
      </div>

      <ContentModal
        open={isConsentOpen}
        onOpenChange={(open) => {
          setIsConsentOpen(open);
          if (!open) setConsentChecked(false);
        }}
        title="Assinar contrato eletronicamente"
        description="O contrato será registrado com hash criptográfico, código de verificação e trilha de auditoria. Após a assinatura, o conteúdo não poderá mais ser alterado."
        contentClassName="sm:max-w-[480px]"
      >
        <div className="flex items-start gap-2 pt-2">
          <Checkbox
            id="contract-consent"
            checked={consentChecked}
            onCheckedChange={(checked) => setConsentChecked(checked === true)}
          />
          <Label htmlFor="contract-consent" className="font-normal text-sm leading-snug">
            Declaro que li o contrato e concordo em assiná-lo eletronicamente.
          </Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" disabled={isSigning} onClick={() => setIsConsentOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={!consentChecked || isSigning}
            onClick={() =>
              signContract({
                patientId,
                pregnancyId: pregnancyId ?? null,
                title,
                clauses_html: clausesHtml,
                city,
                state,
                consent: true,
              })
            }
          >
            {isSigning ? "Assinando..." : "Confirmar e assinar"}
          </Button>
        </div>
      </ContentModal>

      <ContentModal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        title="Preview do Contrato"
        description="Visualização com cabeçalho auto-gerado e cláusulas atuais"
        contentClassName="sm:max-w-[900px]"
      >
        <ContractDocument
          headerBlocks={headerBlocks}
          title={title}
          clausesHtml={clausesHtml}
          isPreview
          signaturePreview={{
            city: city || null,
            state: state || null,
            contratanteName: patientName,
            contratadaName,
          }}
        />
      </ContentModal>
    </>
  );
}

function ContractDocument({
  headerBlocks,
  title,
  clausesHtml,
  isPreview,
  signaturePreview,
  children,
}: {
  headerBlocks: ContractHeaderBlocks | null;
  title?: string;
  clausesHtml: string | null;
  isPreview?: boolean;
  signaturePreview?: {
    city: string | null;
    state: string | null;
    contratanteName: string | null;
    contratadaName: string | null;
  };
  children?: React.ReactNode;
}) {
  const isEditing = !!children;

  return (
    <div className={cn(!isEditing && "overflow-auto rounded-md bg-muted/30 py-4")}>
      <div className={cn(!isEditing && "mx-auto max-w-[794px] rounded-md bg-white")}>
        <div
          className={cn(
            "relative w-full text-black text-sm",
            isEditing
              ? "px-0 py-0"
              : isPreview
                ? "max-w-[794px] overflow-auto rounded-md bg-white px-16 py-12 shadow-md"
                : "max-h-[400px] max-w-[794px] overflow-auto rounded-md bg-white px-16 py-12 shadow-md",
          )}
        >
          {headerBlocks ? (
            <>
              {title && (
                <div className="mb-4 border-gray-200 pb-4 text-lg">
                  <p className="font-semibold">{title}</p>
                </div>
              )}

              <div className="mb-4 border-gray-200 border-b pb-4">
                <p className="font-semibold">CONTRATANTE:</p>
                <p className="mt-1 leading-relaxed">{headerBlocks.contratanteBlock}</p>
              </div>

              <div className="mb-4 border-gray-200 border-b pb-4">
                <p className="font-semibold">CONTRATADA:</p>
                <p className="mt-1 leading-relaxed">{headerBlocks.contratadaBlock}</p>
              </div>

              {headerBlocks.teamMembersBlock && (
                <div className="mb-4 border-gray-200 border-b pb-4">
                  <p className="font-semibold">EQUIPE DE CUIDADO:</p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {headerBlocks.teamMembersBlock}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="mb-4 border-gray-200 border-b pb-4">
              <p className="text-gray-400 text-xs italic">
                Cabeçalho não disponível — dados da gestante ou profissional incompletos.
              </p>
            </div>
          )}

          {children ?? (
            <div
              className="[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_h1]:mb-2 [&_h1]:font-bold [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled HTML from our own rich editor
              dangerouslySetInnerHTML={{
                __html: clausesHtml || "<p><em>Nenhuma cláusula adicionada ainda.</em></p>",
              }}
            />
          )}

          {signaturePreview && (
            <ContractSignaturePreview
              city={signaturePreview.city}
              state={signaturePreview.state}
              contratanteName={signaturePreview.contratanteName}
              contratadaName={signaturePreview.contratadaName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
