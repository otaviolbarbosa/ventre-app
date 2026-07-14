"use client";

import { ESTADOS_BR } from "@/lib/constants";
import type { ProfessionalDocumentsInput } from "@/lib/validations/professional-documents";
import type { ProfessionalType } from "@/types";
import { Button } from "@ventre/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  type ArrayPath,
  type Control,
  type FieldValues,
  type Path,
  useFieldArray,
} from "react-hook-form";

type WithProfessionalDocuments = FieldValues & {
  professional_documents?: ProfessionalDocumentsInput;
};

type ProfessionalDocumentsFieldsProps<TFieldValues extends WithProfessionalDocuments> = {
  control: Control<TFieldValues>;
  professionalType: ProfessionalType | null;
};

export default function ProfessionalDocumentsFields<TFieldValues extends WithProfessionalDocuments>({
  control,
  professionalType,
}: ProfessionalDocumentsFieldsProps<TFieldValues>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "professional_documents.rqe" as ArrayPath<TFieldValues>,
  });

  if (professionalType !== "obstetra" && professionalType !== "fisio" && professionalType !== "enfermeiro") {
    return null;
  }

  const councilField = professionalType === "obstetra" ? "crm" : professionalType === "fisio" ? "crefito" : "coren";
  const councilLabel = professionalType === "obstetra" ? "CRM" : professionalType === "fisio" ? "CREFITO" : "COREN";
  const hasRqe = professionalType === "obstetra" || professionalType === "fisio";

  return (
    <div className="space-y-4 pt-2">
      <p className="font-medium text-sm">Documentos profissionais</p>

      <div className="grid gap-4 sm:grid-cols-4">
        <FormField
          control={control}
          name={`professional_documents.${councilField}.number` as Path<TFieldValues>}
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel>{councilLabel}</FormLabel>
              <FormControl>
                <Input placeholder="Número" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`professional_documents.${councilField}.uf` as Path<TFieldValues>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>UF</FormLabel>
              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ESTADOS_BR.map((estado) => (
                    <SelectItem key={estado.sigla} value={estado.sigla}>
                      {estado.sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {hasRqe && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">RQE</p>
          {fields.map((item, index) => (
            <div key={item.id} className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={control}
                name={`professional_documents.rqe.${index}.number` as Path<TFieldValues>}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormControl>
                      <Input placeholder="Número do RQE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`professional_documents.rqe.${index}.uf` as Path<TFieldValues>}
                render={({ field }) => (
                  <FormItem>
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ESTADOS_BR.map((estado) => (
                          <SelectItem key={estado.sigla} value={estado.sigla}>
                            {estado.sigla}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => remove(index)}
                aria-label="Remover RQE"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ number: "", uf: "" } as unknown as Parameters<typeof append>[0])
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar RQE
          </Button>
        </div>
      )}
    </div>
  );
}
