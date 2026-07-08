"use client";

import { saveBaseContractAction } from "@/actions/save-base-contract-action";
import { Header } from "@/components/layouts/header";
import { ContractSignaturePreview } from "@/components/shared/contract-signature-preview";
import { PageHeader } from "@/components/shared/page-header";
import { ESTADOS_BR } from "@/lib/constants";
import type { ContractHeaderData } from "@/services/base-contract";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { Eye, Save } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type ContractSettingsScreenProps = {
  initialContract: Tables<"contracts"> | null;
  headerData: ContractHeaderData;
};

export default function ContractSettingsScreen({
  initialContract,
  headerData,
}: ContractSettingsScreenProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialContract?.title ?? "CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
  const [clausesHtml, setClausesHtml] = useState(initialContract?.clauses_html ?? "");
  const [city, setCity] = useState(initialContract?.city ?? "");
  const [state, setState] = useState(initialContract?.state ?? "");
  const [showPreview, setShowPreview] = useState(false);

  const { execute: save, isExecuting } = useAction(saveBaseContractAction, {
    onSuccess: () => {
      toast.success("Contrato base salvo com sucesso");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar contrato"),
  });

  return (
    <div className="flex h-full flex-col">
      <Header title="Contrato Padrão" back="/settings" />
      <div className="flex flex-1 flex-col overflow-hidden p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="Configure as cláusulas do contrato base da organização">
          <Button variant="outline" className="hidden sm:flex" onClick={() => setShowPreview(true)}>
            <Eye className="size-4" />
            <span className="ml-1 hidden sm:inline">Preview</span>
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="block flex justify-center sm:hidden sm:hidden"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            className="gradient-primary hidden sm:flex"
            disabled={isExecuting}
            onClick={() => save({ title, clauses_html: clausesHtml, city, state })}
          >
            <Save className="size-4" />
            <span className="ml-1">{isExecuting ? "Salvando..." : "Salvar contrato base"}</span>
          </Button>
          <Button
            size="icon"
            className="gradient-primary block flex justify-center sm:hidden"
            disabled={isExecuting}
            onClick={() => save({ title, clauses_html: clausesHtml, city, state })}
          >
            <Save className="size-4" />
          </Button>
        </PageHeader>

        <div className="mb-4 space-y-1.5">
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

        <div className="mb-4 grid grid-cols-4 gap-4">
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
          className="min-h-0 flex-1 bg-white"
        />
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
  headerData: ContractHeaderData;
  title: string;
  clausesHtml: string;
  city: string;
  state: string;
}) {
  const na = "[não informado]";

  const contratadaName =
    headerData.type === "enterprise" && headerData.enterprise
      ? (headerData.enterprise.legal_name ?? headerData.enterprise.name)
      : headerData.type === "autonomous"
        ? headerData.user.name
        : null;

  const contratadaBlock =
    headerData.type === "enterprise" && headerData.enterprise
      ? [
          `${headerData.enterprise.legal_name ?? headerData.enterprise.name ?? na}, pessoa jurídica de direito privado,`,
          `inscrita no CNPJ sob nº ${headerData.enterprise.cnpj ?? na},`,
          `com sede à ${[headerData.enterprise.street, headerData.enterprise.number, headerData.enterprise.neighborhood, headerData.enterprise.city, headerData.enterprise.state].filter(Boolean).join(", ") || na},`,
          "doravante denominada simplesmente EQUIPE CONTRATADA.",
        ].join(" ")
      : headerData.type === "autonomous"
        ? `${headerData.user.name ?? na}, ${headerData.user.professional_type ?? na}, ${headerData.user.email ?? na}, telefone: ${headerData.user.phone ?? na}, doravante denominada simplesmente EQUIPE CONTRATADA.`
        : na;

  return (
    <div className="flex justify-center bg-muted/30 py-4">
      <div
        className="min-h-[1123px] w-[794px] bg-white text-black text-sm shadow-md"
        style={{ padding: "40px 60px" }}
      >
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

        <div className="mb-6 rounded-sm border border-gray-300 border-dashed bg-gray-50 p-4 text-gray-400 italic">
          <p className="font-medium text-gray-700 not-italic">EQUIPE CONTRATADA:</p>
          <p>[membros da equipe — preenchidos automaticamente ao gerar contrato por paciente]</p>
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
          contratadaName={contratadaName}
        />
      </div>
    </div>
  );
}
