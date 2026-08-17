"use client";

import { createBaseContractFromPatientAction } from "@/actions/create-base-contract-from-patient-action";
import { deactivatePatientContractAction } from "@/actions/deactivate-patient-contract-action";
import { getDocumentDownloadUrlAction } from "@/actions/get-document-download-url-action";
import { getMyAddressAction } from "@/actions/get-my-address-action";
import { getPatientAction } from "@/actions/get-patient-action";
import { getPatientContractAction } from "@/actions/get-patient-contract-action";
import { previewContractPdfAction } from "@/actions/preview-contract-pdf-action";
import { resolveContractChangeRequestAction } from "@/actions/resolve-contract-change-request-action";
import { revokeContractAction } from "@/actions/revoke-contract-action";
import { revokeContractSignaturesAction } from "@/actions/revoke-contract-signatures-action";
import { signPatientContractAction } from "@/actions/sign-patient-contract-action";
import { useAuth } from "@/hooks/use-auth";
import { ESTADOS_BR } from "@/lib/constants";
import type { ContractHeaderBlocks, ContractParty } from "@/lib/contract-header-text";
import { cn } from "@/lib/utils";
import { patientContractFormSchema } from "@/lib/validations/contract";
import { EditPatientModal } from "@/modals/edit-patient-modal";
import { EditProfileModal } from "@/modals/edit-profile-modal";
import type { PatientAddress, ProfessionalType } from "@/types";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ConfirmModal } from "@ventre/ui/shared/confirm-modal";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { Skeleton } from "@ventre/ui/skeleton";
import DOMPurify from "isomorphic-dompurify";
import { Download, Eye, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContractSelector } from "./contract-selector";

const PdfViewer = dynamic(() => import("@/components/shared/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <p className="text-muted-foreground text-sm">Carregando visualizador...</p>,
});

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
  finalizedDocumentId: string | null;
  signedByName: string | null;
};

type ChangeRequest = {
  id: string;
  message_html: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  requested_by: string;
};

type PatientForEdit = Tables<"patients"> & {
  due_date?: string | null;
  dum?: string | null;
  observations?: string | null;
  address?: PatientAddress | null;
};

type ProfileAddress = {
  zipcode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

const PARTY_TYPE_LABELS: Record<ContractParty["type"], string> = {
  patient: "Gestante",
  professional: "Profissional",
  team_member: "Integrante da equipe",
};

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "br", "a"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

function sanitizeMessageHtml(html: string) {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

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
  const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false);
  const [isSignConfirmOpen, setIsSignConfirmOpen] = useState(false);
  const [isEditConfirmOpen, setIsEditConfirmOpen] = useState(false);
  const [fullySignedAt, setFullySignedAt] = useState<string | null>(null);
  const [title, setTitle] = useState("CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
  const [clausesHtml, setClausesHtml] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [patientName, setPatientName] = useState<string | null>(null);
  const [contratadaName, setContratadaName] = useState<string | null>(null);
  const [enterpriseOptions, setEnterpriseOptions] = useState<BaseTemplate[]>([]);
  const [personalOptions, setPersonalOptions] = useState<BaseTemplate[]>([]);
  const [activeHeaderVariant, setActiveHeaderVariant] = useState<"enterprise" | "personal" | null>(
    null,
  );
  const [enterpriseHeaderBlocks, setEnterpriseHeaderBlocks] = useState<ContractHeaderBlocks | null>(
    null,
  );
  const [personalHeaderBlocks, setPersonalHeaderBlocks] = useState<ContractHeaderBlocks | null>(
    null,
  );
  const [savedParties, setSavedParties] = useState<ContractHeaderBlocks | null>(null);
  // The initial PDF now always exists once the contract itself is generated — even
  // before/without a signature — so this is tracked independent of `signatureInfo`
  // (which stays scoped to actual signing metadata).
  const [originalDocumentId, setOriginalDocumentId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [contractExists, setContractExists] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [readonlyPdfSource, setReadonlyPdfSource] = useState<
    { url: string } | { base64: string } | null
  >(null);
  const [isLoadingReadonlyPdf, setIsLoadingReadonlyPdf] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [signDigitally, setSignDigitally] = useState(true);
  const [signatureInfo, setSignatureInfo] = useState<SignatureInfo | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"title" | "city" | "state" | "clausesHtml", string>>
  >({});
  const [headerIncompleteParties, setHeaderIncompleteParties] = useState<ContractParty[]>([]);
  const [personalIncompleteParties, setPersonalIncompleteParties] = useState<ContractParty[]>([]);
  const [isIncompleteDataModalOpen, setIsIncompleteDataModalOpen] = useState(false);
  const [editPatientData, setEditPatientData] = useState<PatientForEdit | null>(null);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isFetchingPatientForEdit, setIsFetchingPatientForEdit] = useState(false);
  const [editProfileAddress, setEditProfileAddress] = useState<ProfileAddress | null>(null);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isFetchingAddressForEdit, setIsFetchingAddressForEdit] = useState(false);
  const clausesContainerRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const headerBlocks =
    activeHeaderVariant === "enterprise"
      ? enterpriseHeaderBlocks
      : activeHeaderVariant === "personal"
        ? personalHeaderBlocks
        : null;

  const activeIncompleteParties =
    activeHeaderVariant === "enterprise"
      ? headerIncompleteParties
      : activeHeaderVariant === "personal"
        ? personalIncompleteParties
        : [];

  const scrollToFirstError = (errors: typeof fieldErrors) => {
    const fieldElementIds: Record<"title" | "city" | "state", string> = {
      title: "contract-title",
      city: "contract-city",
      state: "contract-state",
    };
    const order: Array<keyof typeof fieldErrors> = ["title", "city", "state", "clausesHtml"];
    const firstErrorField = order.find((field) => errors[field]);
    if (!firstErrorField) return;

    if (firstErrorField === "clausesHtml") {
      clausesContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const element = document.getElementById(fieldElementIds[firstErrorField]);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus();
  };

  const { execute: fetchContract, isExecuting: isLoadingFetchContract } = useAction(
    getPatientContractAction,
    {
    onSuccess: ({ data }) => {
      if (data?.headerBlocks) {
        setEnterpriseHeaderBlocks(data.headerBlocks);
        setActiveHeaderVariant((prev) => prev ?? "enterprise");
      }
      if (data?.personalHeaderBlocks) setPersonalHeaderBlocks(data.personalHeaderBlocks);
      setHeaderIncompleteParties(data?.headerIncompleteParties ?? []);
      setPersonalIncompleteParties(data?.personalHeaderIncompleteParties ?? []);
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
        setOriginalDocumentId(data.contract.original_document_id);
        setSignatureInfo(
          data.contract.is_signed
            ? {
                signedAt: data.contract.signed_at,
                verificationCode: data.contract.verification_code,
                finalizedDocumentId: data.contract.finalized_document_id,
                signedByName: data.signedByName ?? null,
              }
            : null,
        );
        setFullySignedAt(data.contract.fully_signed_at ?? null);
        setContractExists(true);
        setMode("readonly");
      } else {
        setOriginalDocumentId(null);
        setMode("select");
      }
      setChangeRequests(data?.changeRequests ?? []);
    },
    onError: () => setMode("select"),
  });

  const { execute: resolveChangeRequest, isExecuting: isResolvingChangeRequest } = useAction(
    resolveContractChangeRequestAction,
    {
      onSuccess: () => {
        toast.success("Solicitação marcada como resolvida");
        fetchContract({ patientId });
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao resolver solicitação"),
    },
  );

  const { executeAsync: signContractAsync, isExecuting: isSigning } = useAction(
    signPatientContractAction,
    {
      onSuccess: () => {
        toast.success(
          signDigitally
            ? "Contrato criado e assinado com sucesso"
            : "Contrato salvo. Você pode assinar em outro momento.",
        );
        setContractExists(true);
        setIsGenerateModalOpen(false);
        setSaveAsTemplate(false);
        setTemplateName("");
        setSignDigitally(true);
        // Reload to pick up the persisted parties_details, contract id and signature
        fetchContract({ patientId });
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao assinar contrato"),
    },
  );

  const { executeAsync: getDownloadUrl } = useAction(getDocumentDownloadUrlAction);

  const { executeAsync: previewContractPdfAsync, isExecuting: isLoadingPreviewPdf } =
    useAction(previewContractPdfAction);

  const { execute: deactivateContract, isExecuting: isDeactivating } = useAction(
    deactivatePatientContractAction,
    {
      onSuccess: () => {
        toast.success("Contrato excluído");
        setContractId("");
        setContractExists(false);
        setSavedParties(null);
        setOriginalDocumentId(null);
        setSignatureInfo(null);
        setIsDeleteConfirmOpen(false);
        setMode("select");
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao excluir contrato"),
    },
  );

  const { execute: revokeContract, isExecuting: isRevoking } = useAction(revokeContractAction, {
    onSuccess: () => {
      toast.success("Contrato revogado. Redija o novo contrato abaixo.");
      setContractId("");
      setContractExists(false);
      setSavedParties(null);
      setOriginalDocumentId(null);
      setSignatureInfo(null);
      setFullySignedAt(null);
      setIsRevokeConfirmOpen(false);
      setMode("select");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao revogar contrato"),
  });

  const { execute: addSignature, isExecuting: isAddingSignature } = useAction(
    signPatientContractAction,
    {
      onSuccess: () => {
        toast.success("Assinatura adicionada ao contrato");
        setIsSignConfirmOpen(false);
        fetchContract({ patientId });
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao assinar contrato"),
    },
  );

  const { execute: revokeSignaturesAndEdit, isExecuting: isRevokingSignatures } = useAction(
    revokeContractSignaturesAction,
    {
      onSuccess: ({ data }) => {
        if (data?.contractId) setContractId(data.contractId);
        setOriginalDocumentId(null);
        setSignatureInfo(null);
        setIsEditConfirmOpen(false);
        setFieldErrors({});
        setMode("editing");
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao revogar assinatura"),
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

  const { executeAsync: fetchPatientForEditAsync } = useAction(getPatientAction);
  const { executeAsync: fetchMyAddressAsync } = useAction(getMyAddressAction);

  // Refreshes only the header blocks/incomplete-parties data — unlike `fetchContract`,
  // it never touches `mode` or the in-progress draft fields (title/city/state/clausesHtml),
  // so it's safe to call while the professional is mid-edit in the contract form.
  const { execute: refreshHeaderData, executeAsync: refreshHeaderDataAsync } = useAction(
    getPatientContractAction,
    {
      onSuccess: ({ data }) => {
        if (data?.headerBlocks) setEnterpriseHeaderBlocks(data.headerBlocks);
        if (data?.personalHeaderBlocks) setPersonalHeaderBlocks(data.personalHeaderBlocks);
        setHeaderIncompleteParties(data?.headerIncompleteParties ?? []);
        setPersonalIncompleteParties(data?.personalHeaderIncompleteParties ?? []);
        setPatientName(data?.patientName ?? null);
        setContratadaName(data?.contratadaName ?? null);
      },
    },
  );

  const isGenerating = isSigning || isCreatingTemplate;

  const handleOpenEditPatient = async () => {
    setIsFetchingPatientForEdit(true);
    try {
      const res = await fetchPatientForEditAsync({ patientId });
      if (res?.data?.patient) {
        setEditPatientData(res.data.patient as PatientForEdit);
        setIsEditPatientModalOpen(true);
      } else {
        toast.error(res?.serverError ?? "Erro ao carregar dados da gestante");
      }
    } finally {
      setIsFetchingPatientForEdit(false);
    }
  };

  const handleOpenEditProfile = async () => {
    setIsFetchingAddressForEdit(true);
    try {
      const res = await fetchMyAddressAsync({});
      setEditProfileAddress(res?.data?.address ?? null);
      setIsEditProfileModalOpen(true);
    } finally {
      setIsFetchingAddressForEdit(false);
    }
  };

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
      scrollToFirstError(errors);
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
      consent: signDigitally,
    });
  };

  const downloadStoredDocument = async (documentId: string) => {
    const res = await getDownloadUrl({ documentId });
    if (res?.data?.url) {
      window.open(res.data.url, "_blank");
    } else {
      toast.error(res?.serverError ?? "Erro ao baixar contrato assinado");
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      // Fully signed: always download the finalized document (both parties' stamps +
      // authentication certificate) — never the professional-only original.
      if (fullySignedAt) {
        if (!signatureInfo?.finalizedDocumentId) {
          toast.error("Documento final ainda não está disponível.");
          return;
        }
        await downloadStoredDocument(signatureInfo.finalizedDocumentId);
        return;
      }

      // Not (yet) fully signed: reuse the stored original PDF — generated whenever
      // the contract itself was generated, signed or not — never re-render.
      if (originalDocumentId) {
        await downloadStoredDocument(originalDocumentId);
        return;
      }

      // Fallback for contracts generated before original_document_id always existed.
      const res = await fetch(`/api/patients/${patientId}/contract/pdf`, {
        method: "POST",
      });
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

  const handleOpenPreview = async () => {
    if (!headerBlocks) return;
    const res = await previewContractPdfAsync({
      headerBlocks,
      title,
      clausesHtml,
      signaturePreview: {
        city: city || null,
        state: state || null,
        contratanteName: patientName,
        contratadaName,
      },
    });
    if (res?.data?.pdfBase64) {
      setPreviewPdfBase64(res.data.pdfBase64);
      setIsPreviewOpen(true);
    } else {
      toast.error(res?.serverError ?? "Erro ao gerar pré-visualização do contrato");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to add fetchContract
  useEffect(() => {
    fetchContract({ patientId });
  }, [patientId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-fetch when entering readonly or the signed document changes
  useEffect(() => {
    if (mode !== "readonly") return;
    let cancelled = false;

    async function loadReadonlyPdf() {
      setIsLoadingReadonlyPdf(true);
      try {
        // Fully signed: always show the finalized document (both parties' stamps +
        // authentication certificate) — never the professional-only original.
        if (fullySignedAt) {
          if (!signatureInfo?.finalizedDocumentId) {
            toast.error("Documento final ainda não está disponível.");
            return;
          }
          const res = await getDownloadUrl({ documentId: signatureInfo.finalizedDocumentId });
          if (cancelled) return;
          if (res?.data?.url) {
            setReadonlyPdfSource({ url: res.data.url });
          } else {
            toast.error(res?.serverError ?? "Erro ao carregar contrato assinado");
          }
          return;
        }

        // Not (yet) fully signed: reuse the stored original PDF — generated whenever
        // the contract itself was generated, signed or not — never re-render.
        if (originalDocumentId) {
          const res = await getDownloadUrl({ documentId: originalDocumentId });
          if (cancelled) return;
          if (res?.data?.url) {
            setReadonlyPdfSource({ url: res.data.url });
          } else {
            toast.error(res?.serverError ?? "Erro ao carregar contrato assinado");
          }
          return;
        }

        const parties = savedParties ?? headerBlocks;
        if (!parties) return;
        const res = await previewContractPdfAsync({
          headerBlocks: parties,
          title,
          clausesHtml,
          signaturePreview: {
            city: city || null,
            state: state || null,
            contratanteName: patientName,
            contratadaName,
          },
        });
        if (cancelled) return;
        if (res?.data?.pdfBase64) {
          setReadonlyPdfSource({ base64: res.data.pdfBase64 });
        } else {
          toast.error(res?.serverError ?? "Erro ao gerar pré-visualização do contrato");
        }
      } finally {
        if (!cancelled) setIsLoadingReadonlyPdf(false);
      }
    }

    loadReadonlyPdf();
    return () => {
      cancelled = true;
    };
  }, [mode, fullySignedAt, originalDocumentId, signatureInfo?.finalizedDocumentId]);

  const handleSelectBaseTemplate = (id: string) => {
    const enterpriseMatch = enterpriseOptions.find((o) => o.id === id);
    const match = enterpriseMatch ?? personalOptions.find((o) => o.id === id);
    if (!match) return;
    setContractId(id);
    setTitle(match.title);
    setClausesHtml(match.html);
    setCity(match.city ?? "");
    setState(match.state ?? "");
    setActiveHeaderVariant(enterpriseMatch ? "enterprise" : "personal");
    setFieldErrors({});
    setMode("editing");
  };

  const handleNewContract = () => {
    setContractId("");
    setTitle("CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
    setClausesHtml("");
    setCity("");
    setState("");
    setActiveHeaderVariant("enterprise");
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
          {changeRequests.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium text-sm">Solicitações de alteração</p>
              {changeRequests.map((request) => (
                <div
                  key={request.id}
                  className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div
                    className="prose-sm"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify with a tight allowlist above
                    dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(request.message_html) }}
                  />
                  {request.status === "resolved" ? (
                    <p className="text-muted-foreground text-xs">
                      Resolvida em{" "}
                      {request.resolved_at
                        ? new Date(request.resolved_at).toLocaleDateString("pt-BR")
                        : ""}
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isResolvingChangeRequest}
                      onClick={() => resolveChangeRequest({ requestId: request.id, patientId })}
                    >
                      Marcar como resolvida
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {readonlyPdfSource ? (
            <div className="max-h-[400px] overflow-auto">
              <PdfViewer source={readonlyPdfSource} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {isLoadingReadonlyPdf ? "Carregando PDF..." : "Não foi possível carregar o PDF."}
            </p>
          )}
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
              {fullySignedAt && (
                <Button variant="outline" onClick={() => setIsRevokeConfirmOpen(true)}>
                  Revogar e redigir novo contrato
                </Button>
              )}
              {!fullySignedAt && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (signatureInfo) {
                      setIsEditConfirmOpen(true);
                      return;
                    }
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
              {!signatureInfo && !fullySignedAt && (
                <Button className="gradient-primary" onClick={() => setIsSignConfirmOpen(true)}>
                  Assinar digitalmente
                </Button>
              )}
            </div>
          </div>
        </div>

        <ContentModal
          open={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          title="Excluir contrato"
          description="O contrato não será apagado permanentemente, porém perderá a validade como instrumento legal. Você poderá gerar um novo contrato para esta gestante a qualquer momento."
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

        <ContentModal
          open={isRevokeConfirmOpen}
          onOpenChange={setIsRevokeConfirmOpen}
          title="Revogar contrato"
          description="O contrato atual será marcado como revogado (permanece consultável para auditoria) e você poderá redigir um novo contrato do zero."
          contentClassName="sm:max-w-[420px]"
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              disabled={isRevoking}
              onClick={() => setIsRevokeConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isRevoking}
              onClick={() => {
                if (contractId) revokeContract({ contractId, patientId });
              }}
            >
              {isRevoking ? "Revogando..." : "Confirmar revogação"}
            </Button>
          </div>
        </ContentModal>

        <ConfirmModal
          open={isSignConfirmOpen}
          onOpenChange={setIsSignConfirmOpen}
          title="Assinar contrato digitalmente"
          description="Sua assinatura digital será adicionada a este contrato, com trilha de auditoria (data, hora, endereço IP). Você confirma que deseja assinar agora?"
          confirmLabel={isAddingSignature ? "Assinando..." : "Confirmar assinatura"}
          loading={isAddingSignature}
          onConfirm={() => {
            addSignature({
              patientId,
              pregnancyId: pregnancyId ?? null,
              title,
              clauses_html: clausesHtml,
              city,
              state,
              consent: true,
            });
          }}
        />

        <ConfirmModal
          open={isEditConfirmOpen}
          onOpenChange={setIsEditConfirmOpen}
          title="Editar contrato assinado"
          description="Este contrato já possui assinatura da profissional. Ao editar agora, todas as assinaturas coletadas serão revogadas e as partes precisarão assinar novamente. Deseja continuar?"
          confirmLabel={isRevokingSignatures ? "Revogando..." : "Continuar e editar"}
          variant="destructive"
          loading={isRevokingSignatures}
          onConfirm={() => {
            if (contractId) revokeSignaturesAndEdit({ contractId, patientId });
          }}
        />
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
        <ContractDocument headerBlocks={headerBlocks} containerRef={clausesContainerRef}>
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
            disabled={isSigning || isLoadingPreviewPdf}
            onClick={handleOpenPreview}
            className="hidden sm:flex"
          >
            {isLoadingPreviewPdf ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Eye className="size-4" />
            )}
            {isLoadingPreviewPdf ? "Gerando pré-visualização..." : "Pré-visualizar"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={isSigning || isLoadingPreviewPdf}
            onClick={handleOpenPreview}
            className="block flex justify-center sm:hidden"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            className="gradient-primary"
            disabled={isSigning || isExporting}
            onClick={() => {
              if (!validateForm()) return;
              if (activeIncompleteParties.length > 0) {
                setIsIncompleteDataModalOpen(true);
                return;
              }
              setIsGenerateModalOpen(true);
            }}
          >
            <Plus className="size-4" />
            {isSigning ? "Gerando contrato..." : "Gerar contrato"}
          </Button>
        </div>
      </div>

      <ContentModal
        open={isIncompleteDataModalOpen}
        onOpenChange={setIsIncompleteDataModalOpen}
        title="Dados incompletos"
        description='Alguns dados aparecem como "[não informado]" no cabeçalho do contrato. Atualize-os antes de gerar o contrato.'
        contentClassName="sm:max-w-[480px]"
      >
        <div className="space-y-3 pt-2">
          {activeIncompleteParties.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todos os dados necessários já foram preenchidos.
            </p>
          ) : (
            activeIncompleteParties.map((party) => (
              <div
                key={`${party.type}-${party.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium text-sm">{party.name}</p>
                  <p className="text-muted-foreground text-xs">{PARTY_TYPE_LABELS[party.type]}</p>
                </div>
                {party.type === "patient" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isFetchingPatientForEdit}
                    onClick={handleOpenEditPatient}
                  >
                    {isFetchingPatientForEdit ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Pencil className="size-4" />
                    )}
                    {isFetchingPatientForEdit ? "Carregando..." : "Editar dados"}
                  </Button>
                )}
                {party.type !== "patient" && party.isCurrentUser && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isFetchingAddressForEdit}
                    onClick={handleOpenEditProfile}
                  >
                    {isFetchingAddressForEdit ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Pencil className="size-4" />
                    )}
                    {isFetchingAddressForEdit ? "Carregando..." : "Editar meu perfil"}
                  </Button>
                )}
              </div>
            ))
          )}
          {activeIncompleteParties.length === 0 && (
            <div className="flex justify-end pt-2">
              <Button
                className="gradient-primary"
                onClick={() => {
                  setIsIncompleteDataModalOpen(false);
                  setIsGenerateModalOpen(true);
                }}
              >
                Continuar
              </Button>
            </div>
          )}
        </div>
      </ContentModal>

      {editPatientData && (
        <EditPatientModal
          open={isEditPatientModalOpen}
          onOpenChange={setIsEditPatientModalOpen}
          patient={editPatientData}
          onSuccess={async () => {
            await refreshHeaderDataAsync({ patientId });
          }}
        />
      )}

      <EditProfileModal
        open={isEditProfileModalOpen}
        onOpenChange={setIsEditProfileModalOpen}
        name={profile?.name ?? ""}
        phone={profile?.phone ?? ""}
        address={editProfileAddress}
        professionalType={(profile?.professional_type as ProfessionalType | null) ?? null}
        professionalDocuments={profile?.professional_documents ?? null}
        personalDocuments={profile?.personal_documents ?? null}
        onSuccess={() => {
          refreshHeaderData({ patientId });
        }}
      />

      <ContentModal
        open={isGenerateModalOpen}
        onOpenChange={(open) => {
          setIsGenerateModalOpen(open);
          if (!open) {
            setSaveAsTemplate(false);
            setTemplateName("");
            setSignDigitally(true);
          }
        }}
        title="Gerar contrato"
        description="Caso deseje criar um modelo de contrato reutilizável a partir deste documento, marque a opção abaixo e atribua um nome para este novo modelo de contrato"
        // description="A assinatura será validada e registrada com segurança, garantindo a autenticidade do contrato. Após assinado, o conteúdo não poderá mais ser alterado."
        contentClassName="sm:max-w-[480px]"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2">
            <Checkbox
              id="sign-digitally"
              checked={signDigitally}
              className="mt-1"
              onCheckedChange={(checked) => setSignDigitally(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="sign-digitally" className="font-normal text-sm leading-snug">
                Assinar contrato digitalmente
              </Label>
              <p className="text-muted-foreground text-xs leading-snug">
                Sua assinatura já irá constar no documento. Caso não deseje assinar neste momento,
                você pode fazer isso em outro momento.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="save-as-template"
              checked={saveAsTemplate}
              className="mt-1"
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

          {saveAsTemplate && (
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
          )}
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
              : signDigitally
                ? isGenerating
                  ? "Gerando e assinando..."
                  : "Gerar e assinar"
                : isGenerating
                  ? "Gerando..."
                  : "Gerar contrato"}
          </Button>
        </div>
      </ContentModal>

      <ContentModal
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) setPreviewPdfBase64(null);
        }}
        title="Pré-visualização do Contrato"
        description="Contrato com cabeçalho auto-gerado e cláusulas atuais"
        contentClassName="sm:max-w-[900px]"
      >
        {previewPdfBase64 ? (
          <PdfViewer source={{ base64: previewPdfBase64 }} />
        ) : (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        )}
      </ContentModal>
    </>
  );
}

function ContractDocument({
  headerBlocks,
  children,
  containerRef,
}: {
  headerBlocks: ContractHeaderBlocks | null;
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={containerRef} className="relative px-0 py-0 text-black text-sm">
      {headerBlocks ? (
        <>
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

      {children}
    </div>
  );
}
