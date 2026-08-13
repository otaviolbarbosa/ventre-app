import { Button } from "@ventre/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ventre/ui/select";
import { Plus } from "lucide-react";
import { useMemo } from "react";

type BaseTemplate = {
  id: string;
  html: string;
  title: string;
  name: string | null;
  city: string | null;
  state: string | null;
};

export const ContractSelector = ({
  contractId,
  enterpriseOptions,
  personalOptions,
  onValueChange,
  onNewContractSelected,
  isLoading,
}: {
  contractId: string;
  enterpriseOptions: BaseTemplate[];
  personalOptions: BaseTemplate[];
  onValueChange: (id: string) => void;
  onNewContractSelected: VoidFunction;
  isLoading: boolean;
}) => {
  const hasContracts = useMemo(
    () => enterpriseOptions.length > 0 || personalOptions.length > 0,
    [enterpriseOptions, personalOptions],
  );

  return (
    <div className="flex flex-col items-start gap-3 px-1 py-4">
      <p className="text-muted-foreground text-sm">
        {isLoading
          ? "Carregando modelos de contratos"
          : hasContracts
            ? "Escolha um modelo da lista abaixo, ou comece um novo contrato."
            : "Nenhum modelo de contrato configurado ainda, mas você pode começar com um novo contrato."}
      </p>
      <div className="flex w-full max-w-md items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Select
            value={contractId}
            disabled={isLoading || !hasContracts}
            onValueChange={onValueChange}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoading
                    ? "Carregando..."
                    : !hasContracts
                      ? "Sem modelos de contrato"
                      : "Selecione um modelo"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {!hasContracts && <span>Nenhum modelo encontrado.</span>}
              {enterpriseOptions.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Modelos de contratos da empresa</SelectLabel>
                  {enterpriseOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name ?? opt.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {personalOptions.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Meus modelos de contratos</SelectLabel>
                  {personalOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name ?? opt.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={onNewContractSelected}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo contrato</span>
          <span className="inline sm:hidden">Novo</span>
        </Button>
      </div>
    </div>
  );
};
