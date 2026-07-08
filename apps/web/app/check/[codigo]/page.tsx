"use client";

import { BadgeCheck, Loader2, Upload, XCircle } from "lucide-react";
import Image from "next/image";
import { use, useRef, useState } from "react";

type VerificationState = "idle" | "uploading" | "success" | "failure";

type VerifyResponse = {
  valid: boolean;
  signedByName?: string | null;
  signedAt?: string | null;
};

export default function CheckContractPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = use(params);
  const [state, setState] = useState<VerificationState>("idle");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  async function handleFile(file: File) {
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/check/${codigo}`, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as VerifyResponse;
      setResult(data);
      setState(data.valid ? "success" : "failure");
    } catch {
      setResult(null);
      setState("failure");
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="-right-40 -top-40 absolute h-[500px] w-[500px] rounded-full bg-primary/6 blur-3xl" />
        <div className="-left-48 absolute top-1/3 h-96 w-96 rounded-full bg-secondary/60 blur-3xl" />
        <div className="-translate-x-1/2 absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-primary/4 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-10">
        <Image
          src="/logo.png"
          alt="Ventre — Agenda de Parto"
          width={180}
          height={64}
          priority
          className="object-contain"
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
          {state === "idle" && (
            <>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm uppercase tracking-widest">
                  Verificação de Contrato
                </p>
                <h1 className="font-bold font-poppins text-2xl text-foreground sm:text-3xl">
                  Confirme a autenticidade
                </h1>
              </div>

              <div className="h-px w-16 rounded-full bg-border" />

              <p className="text-muted-foreground text-sm leading-relaxed">
                Verificando código: <span className="font-medium text-foreground">{codigo}</span>
                <br />
                Envie o PDF do contrato assinado para confirmar sua autenticidade.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-12 text-center transition-colors ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Upload className="h-8 w-8 text-primary" />
                <p className="font-medium text-sm">Arraste o PDF aqui ou clique para selecionar</p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </>
          )}

          {state === "uploading" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-muted-foreground text-sm">Verificando documento...</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                <BadgeCheck className="h-10 w-10 text-emerald-600" strokeWidth={1.5} />
              </div>

              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm uppercase tracking-widest">
                  Documento autêntico
                </p>
                <h1 className="font-bold font-poppins text-2xl text-foreground sm:text-3xl">
                  Contrato verificado
                </h1>
              </div>

              <div className="h-px w-16 rounded-full bg-border" />

              <p className="text-muted-foreground text-sm leading-relaxed">
                Assinado eletronicamente por{" "}
                <span className="font-semibold text-primary">
                  {result?.signedByName ?? "Profissional"}
                </span>{" "}
                em{" "}
                {result?.signedAt
                  ? new Date(result.signedAt).toLocaleString("pt-BR")
                  : "data desconhecida"}
                .
              </p>
            </>
          )}

          {state === "failure" && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-10 w-10 text-destructive" strokeWidth={1.5} />
              </div>

              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm uppercase tracking-widest">
                  Documento não confere
                </p>
                <h1 className="font-bold font-poppins text-2xl text-foreground sm:text-3xl">
                  Não foi possível verificar
                </h1>
              </div>

              <div className="h-px w-16 rounded-full bg-border" />

              <p className="text-muted-foreground text-sm leading-relaxed">
                Não foi possível confirmar a autenticidade deste documento. Verifique se o arquivo
                não foi alterado e se o código está correto.
              </p>

              <button
                type="button"
                onClick={() => {
                  setState("idle");
                  setResult(null);
                }}
                className="gradient-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 font-medium text-sm text-white shadow-soft transition-opacity hover:opacity-90"
              >
                Tentar novamente
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
