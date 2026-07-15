import { FileWarning } from "lucide-react";
import Link from "next/link";

export function ProfessionalDocumentsBanner() {
  return (
    <div className="fixed inset-x-4 bottom-24 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
      <Link
        href="/profile?action=edit-profile"
        className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <FileWarning className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Complete seus dados profissionais</p>
          <p className="mt-1 text-gray-500 text-xs">
            Cadastre seu número de conselho para poder emitir documentos oficiais no futuro.
          </p>
        </div>
      </Link>
    </div>
  );
}
