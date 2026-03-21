"use client";

import { addBackupProfessionalAction } from "@/actions/add-backup-professional-action";
import { searchUsersAction } from "@/actions/search-users-action";
import { ContentModal } from "@/components/shared/content-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type AddBackupProfessionalModalProps = {
  patientId: string;
  professionalType: ProfessionalType;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
};

export default function AddBackupProfessionalModal({
  patientId,
  professionalType,
  isOpen,
  setIsOpen,
  onSuccess,
}: AddBackupProfessionalModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [selected, setSelected] = useState<SearchedUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { executeAsync: executeSearch, isPending: isSearching } = useAction(searchUsersAction);
  const { executeAsync: executeAdd, isPending: isAdding } = useAction(addBackupProfessionalAction);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const res = await executeSearch({ query: searchQuery, types: [professionalType] });
      setResults((res?.data?.users ?? []) as SearchedUser[]);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, professionalType, executeSearch]);

  function handleClose() {
    setIsOpen(false);
    setSearchQuery("");
    setResults([]);
    setSelected(null);
  }

  async function handleAdd() {
    if (!selected) return;

    const res = await executeAdd({ patientId, professionalId: selected.id });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    toast.success(`${selected.name} adicionado(a) como backup`);
    onSuccess();
    handleClose();
  }

  return (
    <ContentModal
      open={isOpen}
      onOpenChange={handleClose}
      title="Adicionar profissional de backup"
      description={`Busque um(a) ${professionalTypeLabels[professionalType]} para atuar como sua backup.`}
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

        <div className="flex justify-end pt-2">
          <Button className="gradient-primary" disabled={!selected || isAdding} onClick={handleAdd}>
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar backup
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}
