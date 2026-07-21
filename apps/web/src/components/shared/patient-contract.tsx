"use client";

import { createBaseContractFromPatientAction } from "@/actions/create-base-contract-from-patient-action";
import { deactivatePatientContractAction } from "@/actions/deactivate-patient-contract-action";
import { getDocumentDownloadUrlAction } from "@/actions/get-document-download-url-action";
import { getPatientContractAction } from "@/actions/get-patient-contract-action";
import { signPatientContractAction } from "@/actions/sign-patient-contract-action";
import { ContractSignaturePreview } from "@/components/shared/contract-signature-preview";
import { ESTADOS_BR } from "@/lib/constants";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { cn } from "@/lib/utils";
import { patientContractFormSchema } from "@/lib/validations/contract";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { Skeleton } from "@ventre/ui/skeleton";
import { Download, Eye, Plus, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ContractSelector } from "./contract-selector";

type Mode = "loading" | "select" | "editing" | "readonly";

type BaseTemplate = {
  id: string;
  html: string;
  title: string;
  name: string | null;
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
  const [contractId, setContractId] = useState<string>("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [title, setTitle] = useState("CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
  const [clausesHtml, setClausesHtml] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [patientName, setPatientName] = useState<string | null>(null);
  const [contratadaName, setContratadaName] = useState<string | null>(null);
  const [enterpriseOptions, setEnterpriseOptions] = useState<BaseTemplate[]>([]);
  const [personalOptions, setPersonalOptions] = useState<BaseTemplate[]>([]);
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
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [signatureInfo, setSignatureInfo] = useState<SignatureInfo | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"title" | "city" | "state" | "clausesHtml", string>>
  >({});

  const { execute: fetchContract, isExecuting: isLoadingFetchContract } = useAction(
    getPatientContractAction,
    {
      onSuccess: ({ data }) => {
        if (data?.headerBlocks) {
          setHeaderBlocks(data.headerBlocks);
          setEnterpriseHeaderBlocks(data.headerBlocks);
        }
        if (data?.personalHeaderBlocks) setPersonalHeaderBlocks(data.personalHeaderBlocks);
        setPatientName(data?.patientName ?? null);
        setContratadaName(data?.contratadaName ?? null);

        setEnterpriseOptions(data?.enterpriseBaseOptions ?? []);
        setPersonalOptions(data?.personalBaseOptions ?? []);

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
        } else {
          setMode("select");
        }
      },
      onError: () => setMode("select"),
    },
  );

  const { executeAsync: signContractAsync, isExecuting: isSigning } = useAction(
    signPatientContractAction,
    {
      onSuccess: () => {
        toast.success("Contrato criado com sucesso");
        setContractExists(true);
        setIsGenerateModalOpen(false);
        setSaveAsTemplate(false);
        setTemplateName("");
        // Reload to pick up the persisted parties_details, contract id and signature
        fetchContract({ patientId });
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao assinar contrato"),
    },
  );

  const { executeAsync: getDownloadUrl } = useAction(getDocumentDownloadUrlAction);

  const { execute: deactivateContract, isExecuting: isDeactivating } = useAction(
    deactivatePatientContractAction,
    {
      onSuccess: () => {
        toast.success("Contrato excluído");
        setContractId("");
        setContractExists(false);
        setSavedParties(null);
        setSignatureInfo(null);
        setIsDeleteConfirmOpen(false);
        setMode("select");
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao excluir contrato"),
    },
  );

  const { executeAsync: createBaseFromPatientAsync, isExecuting: isCreatingTemplate } = useAction(
    createBaseContractFromPatientAction,
    {
      onSuccess: () => {
        toast.success("Modelo de contrato salvo com sucesso");
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar modelo"),
    },
  );

  const isGenerating = isSigning || isCreatingTemplate;

  const validateForm = () => {
    const result = patientContractFormSchema.safeParse({
      title,
      city,
      state,
      clauses_html: clausesHtml,
    });

    if (!result.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] === "clauses_html" ? "clausesHtml" : (issue.path[0] as string);
        errors[field as keyof typeof fieldErrors] = issue.message;
      }
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleGenerateContract = async () => {
    if (saveAsTemplate) {
      const templateResult = await createBaseFromPatientAsync({
        patientId,
        name: templateName,
        title,
        clauses_html: clausesHtml,
        city,
        state,
      });
      if (!templateResult?.data) return;
    }

    await signContractAsync({
      patientId,
      pregnancyId: pregnancyId ?? null,
      title,
      clauses_html: clausesHtml,
      city,
      state,
      consent: true,
    });
  };

  const handleExportPdf = async () => {
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
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to add fetchContract
  useEffect(() => {
    fetchContract({ patientId });
  }, [patientId]);

  const handleSelectBaseTemplate = (id: string) => {
    const enterpriseMatch = enterpriseOptions.find((o) => o.id === id);
    const match = enterpriseMatch ?? personalOptions.find((o) => o.id === id);
    if (!match) return;
    setContractId(id);
    setTitle(match.title);
    setClausesHtml(match.html);
    setCity(match.city ?? "");
    setState(match.state ?? "");
    setHeaderBlocks(enterpriseMatch ? enterpriseHeaderBlocks : personalHeaderBlocks);
    setFieldErrors({});
    setMode("editing");
  };

  const handleNewContract = () => {
    setContractId("");
    setTitle("CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
    setClausesHtml("");
    setCity("");
    setState("");
    setHeaderBlocks(enterpriseHeaderBlocks);
    setFieldErrors({});
    setMode("editing");
  };

  const handleCancelContractForm = () => {
    setContractId("");
    setFieldErrors({});
    setMode(contractExists ? "readonly" : "select");
  };

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
        <span>Carregando contrato...</span>
      </div>
    );
  }

  if (mode === "select") {
    return (
      <ContractSelector
        contractId={contractId}
        enterpriseOptions={enterpriseOptions}
        personalOptions={personalOptions}
        onValueChange={handleSelectBaseTemplate}
        onNewContractSelected={handleNewContract}
        isLoading={isLoadingFetchContract}
      />
    );
  }

  if (mode === "readonly") {
    return (
      <>
        <div className="space-y-3 pt-2">
          {/* {signatureInfo && (
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
          )} */}
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
              <Trash2 className="size-4" />
              Excluir contrato
            </Button>
            <div className="flex gap-2">
              {!signatureInfo && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFieldErrors({});
                    setMode("editing");
                  }}
                >
                  Editar contrato
                </Button>
              )}
              <Button variant="outline" disabled={isExporting} onClick={handleExportPdf}>
                <Download className="size-4" />
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
      <div className="space-y-3 px-1 pt-2">
        <div className="mb-6 space-y-2">
          <label htmlFor="contract-title" className="font-medium text-sm">
            Título do contrato
          </label>
          <Input
            id="contract-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
            }}
            placeholder="Título do contrato"
            aria-invalid={!!fieldErrors.title}
          />
          {fieldErrors.title && <p className="text-destructive text-sm">{fieldErrors.title}</p>}
        </div>
        <div className="mb-6 grid grid-cols-1 grid-cols-4 gap-4">
          <div className="col-span-3 space-y-2">
            <label htmlFor="contract-city" className="font-medium text-sm">
              Cidade
            </label>
            <Input
              id="contract-city"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
              }}
              placeholder="Cidade"
              aria-invalid={!!fieldErrors.city}
            />
            {fieldErrors.city && <p className="text-destructive text-sm">{fieldErrors.city}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="contract-state" className="font-medium text-sm">
              Estado
            </label>
            <Select
              value={state || undefined}
              onValueChange={(value) => {
                setState(value);
                if (fieldErrors.state) setFieldErrors((prev) => ({ ...prev, state: undefined }));
              }}
            >
              <SelectTrigger id="contract-state" aria-invalid={!!fieldErrors.state}>
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
            {fieldErrors.state && <p className="text-destructive text-sm">{fieldErrors.state}</p>}
          </div>
        </div>
        <ContractDocument headerBlocks={headerBlocks} clausesHtml={null}>
          <RichEditor
            content={clausesHtml}
            onChange={(html) => {
              setClausesHtml(html);
              if (fieldErrors.clausesHtml)
                setFieldErrors((prev) => ({ ...prev, clausesHtml: undefined }));
            }}
            placeholder="Cláusulas do contrato..."
            className={cn(
              "max-h-[400px] min-h-[200px] bg-white",
              fieldErrors.clausesHtml && "border-destructive",
            )}
          />
        </ContractDocument>
        {fieldErrors.clausesHtml && (
          <p className="text-destructive text-sm">{fieldErrors.clausesHtml}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isSigning} onClick={handleCancelContractForm}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={isSigning}
            onClick={() => setIsPreviewOpen(true)}
            className="hidden sm:flex"
          >
            <Eye className="size-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={isSigning}
            onClick={() => setIsPreviewOpen(true)}
            className="block flex justify-center sm:hidden"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            className="gradient-primary"
            disabled={isSigning || isExporting}
            onClick={() => {
              if (validateForm()) setIsGenerateModalOpen(true);
            }}
          >
            <Plus className="size-4" />
            {isSigning ? "Gerando contrato..." : "Gerar contrato"}
          </Button>
        </div>
      </div>

      <ContentModal
        open={isGenerateModalOpen}
        onOpenChange={(open) => {
          setIsGenerateModalOpen(open);
          if (!open) {
            setSaveAsTemplate(false);
            setTemplateName("");
          }
        }}
        title="Gerar contrato"
        description="A assinatura será validada e registrada com segurança, garantindo a autenticidade do contrato. Após assinado, o conteúdo não poderá mais ser alterado."
        contentClassName="sm:max-w-[480px]"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2">
            <Checkbox
              id="save-as-template"
              checked={saveAsTemplate}
              onCheckedChange={(checked) => setSaveAsTemplate(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="save-as-template" className="font-normal text-sm leading-snug">
                Criar modelo de contrato a partir deste documento
              </Label>
              <p className="text-muted-foreground text-xs leading-snug">
                Um modelo de contrato pode ser reutilizado para outras pacientes.
              </p>
            </div>
          </div>

          {
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do modelo</Label>
              <Input
                id="template-name"
                disabled={!saveAsTemplate}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nome do modelo"
              />
            </div>
          }
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="ghost"
            disabled={isGenerating}
            onClick={() => setIsGenerateModalOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={isGenerating || (saveAsTemplate && !templateName.trim())}
            onClick={handleGenerateContract}
          >
            {saveAsTemplate
              ? isGenerating
                ? "Salvando e gerando..."
                : "Salvar e Gerar"
              : isGenerating
                ? "Gerando..."
                : "Gerar contrato"}
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
    <div className={cn(!isEditing && "flex overflow-x-auto rounded-md bg-muted/30 py-4")}>
      <div className={cn(!isEditing && "w-[794px] shrink-0 rounded-md bg-white shadow-md")}>
        <div
          className={cn(
            "relative text-black text-sm",
            isEditing
              ? "px-0 py-0"
              : isPreview
                ? "px-16 py-12"
                : "max-h-[400px] overflow-auto px-16 py-12",
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
            <>
              <div className="mb-4 border-gray-200 border-b pb-4">
                <p className="font-semibold">CONTRATANTE:</p>
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </div>

              <div className="mb-4 border-gray-200 border-b pb-4">
                <p className="font-semibold">CONTRATADA:</p>
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </div>
            </>
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
