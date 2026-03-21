"use client";

import { addProfessionalToTeamAction } from "@/actions/add-professional-to-team-action";
import { searchUsersAction } from "@/actions/search-users-action";
import { ContentModal } from "@/components/shared/content-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfessionalType } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { Loader2, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SearchedUser = {
  id: string;
  name: string;
  email: string;
  professional_type: string;
};

const ROLE_OPTIONS: ProfessionalType[] = ["obstetra", "enfermeiro", "doula"];

type AddProfessionalModalProps = {
  patientId: string;
  availableTypes: ProfessionalType[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddProfessionalModal({
  patientId,
  availableTypes,
  isOpen,
  setIsOpen,
  onSuccess,
}: AddProfessionalModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [selected, setSelected] = useState<SearchedUser | null>(null);
  const [professionalType, setProfessionalType] = useState<ProfessionalType | "">("");
  const [isBackup, setIsBackup] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { executeAsync: executeSearch, isPending: isSearching } = useAction(searchUsersAction);
  const { executeAsync: executeAdd, isPending: isAdding } = useAction(
    addProfessionalToTeamAction,
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const res = await executeSearch({ query: searchQuery });
      setResults((res?.data?.users ?? []) as SearchedUser[]);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, executeSearch]);

  function handleClose() {
    setIsOpen(false);
    setSearchQuery("");
    setResults([]);
    setSelected(null);
    setProfessionalType("");
    setIsBackup(false);
  }

  async function handleAdd() {
    if (!selected || !professionalType) return;

    const res = await executeAdd({
      patientId,
      professionalId: selected.id,
      professionalType,
      isBackup,
    });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    toast.success(`${selected.name} adicionado(a) à equipe`);
    onSuccess();
    handleClose();
  }

  const canSubmit = !!selected && !!professionalType && !isAdding;

  return (
    <ContentModal
      open={isOpen}
      onOpenChange={handleClose}
      title="Adicionar profissional"
      description="Busque e adicione um profissional à equipe de cuidado da gestante."
    >
      <div className="space-y-4 pt-2">
        {selected ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
            <div>
              <p className="font-medium text-sm">{selected.name}</p>
              <p className="text-muted-foreground text-xs">
                {selected.email} ·{" "}
                {professionalTypeLabels[selected.professional_type] ?? selected.professional_type}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Buscar profissional</Label>
            <div className="relative">
              <Input
                placeholder="Nome ou email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {isSearching && (
                <div className="-translate-y-1/2 absolute top-1/2 right-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isSearching && results.length > 0 && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-card shadow-md">
                  {results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelected(user);
                        setSearchQuery("");
                        setResults([]);
                        if (
                          user.professional_type &&
                          ROLE_OPTIONS.includes(user.professional_type as ProfessionalType)
                        ) {
                          setProfessionalType(user.professional_type as ProfessionalType);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{user.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {professionalTypeLabels[user.professional_type] ?? user.professional_type}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">{user.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {!isSearching && searchQuery.length >= 2 && results.length === 0 && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-md border bg-card px-3 py-4 shadow-md">
                  <p className="text-center text-muted-foreground text-sm">
                    Nenhum profissional encontrado
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Especialidade</Label>
            <Select
              value={professionalType}
              onValueChange={(v) => setProfessionalType(v as ProfessionalType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {professionalTypeLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Função</Label>
            <Select
              value={isBackup ? "backup" : "titular"}
              onValueChange={(v) => setIsBackup(v === "backup")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="titular" disabled={availableTypes.length === 0}>
                  Titular
                </SelectItem>
                <SelectItem value="backup">Backup</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button className="gradient-primary" disabled={!canSubmit} onClick={handleAdd}>
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}
