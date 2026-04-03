"use client";

import { deleteDocumentAction } from "@/actions/delete-document-action";
import { getDocumentDownloadUrlAction } from "@/actions/get-document-download-url-action";
import { getPatientDocumentsAction } from "@/actions/get-patient-documents-action";
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Skeleton } from "@ventre/ui/skeleton";
import {
  Download,
  File,
  FileImage,
  FileText,
  FolderOpen,
  LayoutGrid,
  List,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Document = {
  id: string;
  patient_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  uploader: { id: string; name: string } | null;
  preview_url: string | null;
};

type ViewMode = "list" | "grid";

type PatientDocumentsProps = {
  patientId: string;
};

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PatientDocuments({ patientId }: PatientDocumentsProps) {
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dragging, setDragging] = useState(false);
  const { confirm } = useConfirmModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const {
    execute: fetchDocuments,
    result: documentsResult,
    isPending: isFetchingDocs,
  } = useAction(getPatientDocumentsAction);
  const { executeAsync: downloadDocument } = useAction(getDocumentDownloadUrlAction);
  const { executeAsync: deleteDocument } = useAction(deleteDocumentAction);

  useEffect(() => {
    fetchDocuments({ patientId });
  }, [fetchDocuments, patientId]);

  const documents = (documentsResult.data?.documents ?? []) as Document[];
  const currentUserId = documentsResult.data?.currentUserId ?? null;
  const loading = isFetchingDocs || documentsResult.data === undefined;

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of fileArray) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`/api/patients/${patientId}/documents`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || `Erro ao enviar ${file.name}`);
          continue;
        }

        successCount++;
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Documento enviado com sucesso"
          : `${successCount} documentos enviados com sucesso`,
      );
      fetchDocuments({ patientId });
    }
    setUploading(false);
  };

  const handleDownload = async (doc: Document) => {
    const result = await downloadDocument({ documentId: doc.id });
    if (!result?.data?.url) {
      toast.error("Erro ao baixar documento");
      return;
    }
    window.open(result.data.url, "_blank");
  };

  function handleConfirmDelete(doc: Document) {
    confirm({
      title: "Excluir documento",
      description: `Tem certeza que deseja excluir "${doc.file_name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
      onConfirm: async () => {
        const result = await deleteDocument({ documentId: doc.id });
        if (!result?.data?.success) {
          toast.error(result?.serverError ?? "Erro ao excluir documento");
          return;
        }
        toast.success("Documento excluído com sucesso");
        fetchDocuments({ patientId });
      },
    });
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full border p-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>

        <Button
          size="sm"
          className="gradient-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Enviar Documento
        </Button>
      </div>

      {/* Drop zone overlay */}
      {dragging && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-primary border-dashed bg-primary/5 py-12 text-center">
          <Upload className="mb-2 h-8 w-8 text-primary" />
          <p className="font-medium text-primary text-sm">Solte os arquivos aqui</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Document list */}
      {!dragging && documents.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum documento"
          description="Envie documentos como exames, laudos e receitas da paciente."
        />
      )}

      {!dragging && documents.length > 0 && viewMode === "list" && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.file_type);
            const isImage = doc.file_type.startsWith("image/");
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/50"
              >
                {isImage && doc.preview_url ? (
                  <img
                    src={doc.preview_url}
                    alt={doc.file_name}
                    className="size-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{doc.file_name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>·</span>
                    {/* <span>{doc.uploader?.name || "Desconhecido"}</span> */}
                    {/* <span>·</span> */}
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {currentUserId === doc.uploaded_by && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleConfirmDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!dragging && documents.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.file_type);
            const isImage = doc.file_type.startsWith("image/");
            return (
              <Card key={doc.id} className="overflow-hidden">
                <CardContent className="p-3">
                  {isImage && doc.preview_url ? (
                    <div className="relative mb-2 max-h-16 overflow-hidden rounded-lg">
                      <img
                        src={doc.preview_url}
                        alt={doc.file_name}
                        className="aspect-square w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mb-2 flex items-center justify-center rounded-lg bg-muted py-4">
                      <Icon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="truncate font-medium text-sm">{doc.file_name}</p>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {formatFileSize(doc.file_size)}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {currentUserId === doc.uploaded_by && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() =>
                          confirm({
                            title: "Excluir documento",
                            description: `Tem certeza que deseja excluir "${doc.file_name}"? Esta ação não pode ser desfeita.`,
                            confirmLabel: "Excluir",
                            variant: "destructive",
                            onConfirm: async () => {
                              const result = await deleteDocument({ documentId: doc.id });
                              if (!result?.data?.success) {
                                toast.error(result?.serverError ?? "Erro ao excluir documento");
                                return;
                              }
                              toast.success("Documento excluído com sucesso");
                              fetchDocuments({ patientId });
                            },
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
