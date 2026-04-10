"use client";

import { addEnterpriseProfessionalAction } from "@/actions/add-enterprise-professional-action";
import {
  type ProfessionalSearchResult,
  searchProfessionalsAction,
} from "@/actions/search-professionals-action";
import { cn } from "@/lib/utils";
import AddNewProfessionalModal from "@/modals/add-new-professional-modal";
import { professionalTypeLabels } from "@/utils/team";
import { Avatar, AvatarFallback, AvatarImage } from "@ventre/ui/avatar";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type AddEnterpriseProfessionalModalProps = {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  onSuccess?: VoidFunction;
};

export default function AddEnterpriseProfessionalModal({
  showModal,
  setShowModal,
  onSuccess,
}: AddEnterpriseProfessionalModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfessionalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<ProfessionalSearchResult[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const result = await searchProfessionalsAction({ query: q });
      if (result?.data) {
        setResults(result.data.professionals);
        setShowDropdown(true);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(prof: ProfessionalSearchResult) {
    if (!selected.find((p) => p.id === prof.id)) {
      setSelected((prev) => [...prev, prof]);
    }
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  }

  function handleRemove(id: string) {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleAdd() {
    if (selected.length === 0) return;
    setIsAdding(true);
    let successCount = 0;
    try {
      for (const prof of selected) {
        const result = await addEnterpriseProfessionalAction({ email: prof.email });
        if (result?.serverError) {
          toast.error(`${prof.name}: ${result.serverError}`);
        } else {
          successCount++;
        }
      }
      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? `${selected[0]?.name ?? "Profissional"} adicionada com sucesso!`
            : "Profissionais adicionadas com sucesso!",
        );
        setSelected([]);
        onSuccess?.();
        setShowModal(false);
        router.refresh();
      }
    } catch {
      toast.error("Erro ao adicionar profissional.");
    } finally {
      setIsAdding(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected([]);
      setShowDropdown(false);
    }
    setShowModal(open);
  }

  const filteredResults = results.filter((r) => !selected.find((s) => s.id === r.id));

  return (
    <ContentModal
      open={showModal}
      onOpenChange={handleClose}
      title="Adicionar Profissional"
      description="Busque pelo nome ou e-mail de uma profissional já cadastrada na plataforma para associá-la à sua organização."
    >
      <div className="min-h-[50vh]">
        <div className="space-y-4 py-2">
          <div className="space-y-1.5" ref={containerRef}>
            <Label htmlFor="professional-search-input">Nome ou e-mail da profissional</Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <Input
                id="professional-search-input"
                placeholder="Ex: Maria ou maria@exemplo.com"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => filteredResults.length > 0 && setShowDropdown(true)}
                className="pl-9"
                autoComplete="off"
              />
              {showDropdown && filteredResults.length > 0 && (
                <div className="absolute top-full z-50 mt-1 w-full rounded-xl border bg-background shadow-lg">
                  <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto p-2">
                    {filteredResults.map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelect(prof)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60",
                        )}
                      >
                        <Avatar className="h-9 w-9 shrink-0 shadow-md">
                          <AvatarImage
                            src={prof.avatar_url ?? undefined}
                            alt={prof.name}
                            className="rounded-full object-cover"
                          />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(prof.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">{prof.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {prof.professional_type
                              ? (professionalTypeLabels[prof.professional_type] ??
                                prof.professional_type)
                              : "Profissional"}
                          </p>
                          <p className="text-muted-foreground text-xs">{prof.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <RegisterNewLink query={query} onOpen={() => setShowNewModal(true)} />
                </div>
              )}
              {showDropdown && !isSearching && query.trim() && filteredResults.length === 0 && (
                <div className="absolute top-full z-50 mt-1 w-full rounded-xl border bg-background shadow-lg">
                  <div className="px-4 py-3">
                    <p className="text-muted-foreground text-sm">
                      Nenhuma profissional encontrada.
                    </p>
                  </div>
                  <RegisterNewLink query={query} onOpen={() => setShowNewModal(true)} />
                </div>
              )}
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-col gap-2">
              {selected.map((prof) => (
                <div
                  key={prof.id}
                  className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3"
                >
                  <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                    <AvatarImage
                      src={prof.avatar_url ?? undefined}
                      alt={prof.name}
                      className="rounded-full object-cover"
                    />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {getInitials(prof.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{prof.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {prof.professional_type
                        ? (professionalTypeLabels[prof.professional_type] ?? prof.professional_type)
                        : "Profissional"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(prof.id)}
                    className="rounded-full p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowModal(false)} disabled={isAdding}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            onClick={handleAdd}
            disabled={selected.length === 0 || isAdding}
          >
            {isAdding
              ? "Adicionando..."
              : selected.length > 1
                ? `Adicionar ${selected.length} profissionais`
                : "Adicionar"}
          </Button>
        </div>

        <AddNewProfessionalModal
          showModal={showNewModal}
          setShowModal={setShowNewModal}
          initialQuery={query}
          onSuccess={() => {
            onSuccess?.();
            setShowModal(false);
          }}
        />
      </div>
    </ContentModal>
  );
}

function RegisterNewLink({ query, onOpen }: { query: string; onOpen: () => void }) {
  return (
    <div className="border-t px-2 py-1.5">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-primary text-sm transition-colors hover:bg-primary/5"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span>Cadastrar uma nova profissional</span>
        {query.trim() && (
          <span className="truncate text-muted-foreground text-xs">"{query.trim()}"</span>
        )}
      </button>
    </div>
  );
}
