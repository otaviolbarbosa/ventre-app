"use client";

import { previewContractPdfAction } from "@/actions/preview-contract-pdf-action";
import { savePersonalContractAction } from "@/actions/save-personal-contract-action";
import { Header } from "@/components/layouts/header";
import { SaveContractChoiceModal } from "@/components/shared/save-contract-choice-modal";
import { SaveNewTemplateModal } from "@/components/shared/save-new-template-modal";
import { NAO_INFORMADO, buildContractHeaderBlocks } from "@/lib/contract-header-text";
import type { getPersonalContractHeaderData } from "@/services/base-contract";

type PersonalHeaderData = Awaited<ReturnType<typeof getPersonalContractHeaderData>>;

import { ESTADOS_BR } from "@/lib/constants";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { Eraser, Eye, LoaderCircle, Save } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const PdfViewer = dynamic(() => import("@/components/shared/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <p className="text-muted-foreground text-sm">Carregando visualizador...</p>,
});

// "name"/"phone" are NOT NULL columns on patients, so we fill them with the same
// placeholder text used for the nullable fields instead of leaving them blank.
const PLACEHOLDER_PATIENT = {
  name: NAO_INFORMADO,
  email: null,
  phone: NAO_INFORMADO,
  date_of_birth: null,
  rg: null,
  cpf: null,
  marital_status: null,
  occupation: null,
} as const;

const DEFAULT_TITLE = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";

type PersonalContractSettingsScreenProps = {
  contracts: Tables<"contracts">[];
  headerData: PersonalHeaderData;
};

export default function PersonalContractSettingsScreen({
  contracts,
  headerData,
}: PersonalContractSettingsScreenProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>("");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [clausesHtml, setClausesHtml] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [showSaveChoiceModal, setShowSaveChoiceModal] = useState(false);
  const [showSaveNewModal, setShowSaveNewModal] = useState(false);
  const pendingActionRef = useRef<"edit" | "create" | null>(null);

  const hasContracts = useMemo(() => contracts.length > 0, [contracts]);

  const { executeAsync: previewContractPdfAsync, isExecuting: isLoadingPreviewPdf } =
    useAction(previewContractPdfAction);

  async function handleOpenPreview() {
    const headerBlocks = buildContractHeaderBlocks(PLACEHOLDER_PATIENT, null, headerData);
    const res = await previewContractPdfAsync({
      headerBlocks,
      title,
      clausesHtml,
      signaturePreview: {
        city: city || null,
        state: state || null,
        contratanteName: "[Nome da gestante]",
        contratadaName: headerData.user.name,
      },
    });
    if (res?.data?.pdfBase64) {
      setPreviewPdfBase64(res.data.pdfBase64);
      setShowPreview(true);
    } else {
      toast.error(res?.serverError ?? "Erro ao gerar pré-visualização do contrato");
    }
  }

  function handleNewContract() {
    setSelectedId("");
    setTitle(DEFAULT_TITLE);
    setClausesHtml("");
    setCity("");
    setState("");
  }

  function handleSelectTemplate(id: string) {
    const contract = contracts.find((c) => c.id === id);
    if (!contract) return;
    setSelectedId(id);
    setTitle(contract.title);
    setClausesHtml(contract.clauses_html);
    setCity(contract.city ?? "");
    setState(contract.state ?? "");
  }

  const { execute: save, isExecuting } = useAction(savePersonalContractAction, {
    onSuccess: () => {
      toast.success("Modelo de contrato salvo com sucesso");
      if (pendingActionRef.current === "create") {
        setShowSaveNewModal(false);
        handleNewContract();
      }
      if (pendingActionRef.current === "edit") {
        setShowSaveChoiceModal(false);
      }
      pendingActionRef.current = null;
      router.refresh();
    },
    onError: ({ error }) => {
      pendingActionRef.current = null;
      toast.error(error.serverError ?? "Erro ao salvar contrato");
    },
  });

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Meus Modelos Contrato"
        back="/profile/settings"
        subtitle="Configure as cláusulas dos modelos de contrato pessoal"
      />
      <div className="flex flex-1 flex-col overflow-hidden p-4 pt-0 md:p-6 md:pt-0">
        <div className="mb-4 flex shrink-0 justify-end">
          <Button
            variant="outline"
            onClick={handleOpenPreview}
            disabled={isLoadingPreviewPdf}
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
            onClick={handleOpenPreview}
            disabled={isLoadingPreviewPdf}
            className="sm:hidden"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            disabled={isExecuting}
            className="gradient-primary"
            onClick={() => {
              if (selectedId) {
                setShowSaveChoiceModal(true);
                return;
              }
              setShowSaveNewModal(true);
            }}
          >
            <Save className="size-4" />
            <span className="ml-1">{isExecuting ? "Salvando..." : "Salvar modelo"}</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mb-4 flex shrink-0 items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="contract-template" className="font-medium text-sm">
                Modelo de Contrato
              </label>
              <Select
                value={selectedId}
                disabled={!hasContracts}
                onValueChange={handleSelectTemplate}
              >
                <SelectTrigger id="contract-template">
                  <SelectValue
                    placeholder={hasContracts ? "Selecione um modelo" : "Nenhum modelo disponível"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleNewContract}
              className="shrink-0"
            >
              <Eraser className="size-4" />
              <span className="ml-1 hidden sm:inline">Limpar campos</span>
              <span className="ml-1 inline sm:hidden">Limpar</span>
            </Button>
          </div>

          <div className="mb-4 shrink-0 space-y-1.5">
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

          <div className="mb-4 grid shrink-0 grid-cols-4 gap-4">
            <div className="col-span-3 space-y-1.5">
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
            <div className="space-y-1.5">
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

          <RichEditor
            content={clausesHtml}
            onChange={setClausesHtml}
            placeholder="Escreva as cláusulas do contrato..."
            className="min-h-[280px] flex-1 bg-white"
          />
        </div>
      </div>

      <ContentModal
        open={showPreview}
        onOpenChange={(open) => {
          setShowPreview(open);
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

      <SaveContractChoiceModal
        open={showSaveChoiceModal}
        onOpenChange={setShowSaveChoiceModal}
        isPending={isExecuting}
        onSaveCurrent={() => {
          pendingActionRef.current = "edit";
          save({
            contractId: selectedId,
            name: undefined,
            title,
            clauses_html: clausesHtml,
            city,
            state,
          });
        }}
        onCreateNew={() => {
          setShowSaveChoiceModal(false);
          setShowSaveNewModal(true);
        }}
      />

      <SaveNewTemplateModal
        open={showSaveNewModal}
        onOpenChange={setShowSaveNewModal}
        isPending={isExecuting}
        onConfirm={(name) => {
          pendingActionRef.current = "create";
          save({
            contractId: undefined,
            name,
            title,
            clauses_html: clausesHtml,
            city,
            state,
          });
        }}
      />
    </div>
  );
}
