"use client";

import { finishPatientCareAction } from "@/actions/finish-patient-care-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface FinishCareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess: () => void;
}

export function FinishCareModal({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: FinishCareModalProps) {
  const [addBornAt, setAddBornAt] = useState(false);
  const [bornAt, setBornAt] = useState("");
  const [description, setDescription] = useState("");

  const router = useRouter();
  const { executeAsync, isPending } = useAction(finishPatientCareAction);

  async function handleSubmit() {
    const res = await executeAsync({
      patientId,
      bornAt: addBornAt && bornAt ? bornAt : undefined,
      description: description || undefined,
    });

    if (res?.serverError) {
      toast.error(res.serverError);
      return;
    }

    toast.success("Acompanhamento finalizado com sucesso!");
    setAddBornAt(false);
    setBornAt("");
    setDescription("");
    onOpenChange(false);
    onSuccess();
    router.push("/patients");
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const fields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="addBornAt" className="flex cursor-pointer items-center gap-2">
          <input
            id="addBornAt"
            type="checkbox"
            checked={addBornAt}
            onChange={(e) => {
              setAddBornAt(e.target.checked);
              if (!e.target.checked) setBornAt("");
            }}
            className="size-4 rounded border-input accent-primary"
          />
          <span className="font-medium text-sm leading-none">Adicionar data de nascimento</span>
        </label>
        {addBornAt && (
          <Input
            id="bornAt"
            type="date"
            value={bornAt}
            onChange={(e) => setBornAt(e.target.value)}
          />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          placeholder="Descreva como foi o acompanhamento..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Finalizar Acompanhamento</SheetTitle>
            <SheetDescription>
              Registre o encerramento do acompanhamento desta gestante.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{fields}</div>
          <SheetFooter className="mt-4 flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar Acompanhamento</DialogTitle>
          <DialogDescription>
            Registre o encerramento do acompanhamento desta gestante.
          </DialogDescription>
        </DialogHeader>
        {fields}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="gradient-primary" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
