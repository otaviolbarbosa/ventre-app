"use client";

import { savePersonalContractAction } from "@/actions/save-personal-contract-action";
import { Header } from "@/components/layouts/header";
import { ContractSignaturePreview } from "@/components/shared/contract-signature-preview";
import { PageHeader } from "@/components/shared/page-header";
import { SaveContractChoiceModal } from "@/components/shared/save-contract-choice-modal";
import { SaveNewTemplateModal } from "@/components/shared/save-new-template-modal";
import type { getPersonalContractHeaderData } from "@/services/base-contract";

type PersonalHeaderData = Awaited<ReturnType<typeof getPersonalContractHeaderData>>;
import { ESTADOS_BR } from "@/lib/constants";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { Eraser, Eye, Save } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
  const [showSaveChoiceModal, setShowSaveChoiceModal] = useState(false);
  const [showSaveNewModal, setShowSaveNewModal] = useState(false);
  const pendingActionRef = useRef<"edit" | "create" | null>(null);

  const hasContracts = useMemo(() => contracts.length > 0, [contracts]);

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
        <PageHeader splitted className="shrink-0">
          <Button variant="outline" onClick={() => setShowPreview(true)} className="hidden sm:flex">
            <Eye className="size-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPreview(true)}
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
        </PageHeader>

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
        onOpenChange={setShowPreview}
        title="Preview do Contrato"
        description="Visualização com cabeçalho auto-gerado e cláusulas atuais"
        contentClassName="sm:max-w-[900px]"
      >
        <ContractPreview
          headerData={headerData}
          title={title}
          clausesHtml={clausesHtml}
          city={city}
          state={state}
        />
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

function ContractPreview({
  headerData,
  title,
  clausesHtml,
  city,
  state,
}: {
  headerData: PersonalHeaderData;
  title: string;
  clausesHtml: string;
  city: string;
  state: string;
}) {
  const na = "[não informado]";
  const { user } = headerData;

  const contratadaBlock = `${user.name ?? na}, ${user.professional_type ?? na}, ${user.email ?? na}, telefone: ${user.phone ?? na}, doravante denominada simplesmente CONTRATADA.`;

  return (
    <div className="flex overflow-x-auto bg-muted/30 py-4">
      <div className="w-[794px] shrink-0 bg-white px-10 py-14 text-black text-sm shadow-md">
        <div>
          <div className="mb-6 pb-4">
            <p className="font-semibold text-lg">{title}</p>
          </div>

          <div className="mb-6 rounded-sm border border-gray-300 border-dashed bg-gray-50 p-4 text-gray-400 italic">
            <p className="font-medium text-gray-700 not-italic">CONTRATANTE:</p>
            <p>[dados da gestante — preenchidos automaticamente ao gerar contrato por paciente]</p>
          </div>

          <div className="mb-4 border-gray-200 border-b pb-4">
            <p className="font-semibold">CONTRATADA:</p>
            <p className="mt-1 whitespace-pre-wrap">{contratadaBlock}</p>
          </div>

          <div
            className="[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_h1]:mb-2 [&_h1]:font-bold [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: keep it for now
            dangerouslySetInnerHTML={{
              __html: clausesHtml || "<p><em>Nenhuma cláusula adicionada ainda.</em></p>",
            }}
          />

          <ContractSignaturePreview
            city={city || null}
            state={state || null}
            contratanteName="[Nome da gestante]"
            contratadaName={user.name}
          />
        </div>
      </div>
    </div>
  );
}
