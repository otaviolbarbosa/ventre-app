"use client";

import type { PersonalDocumentsInput } from "@/lib/validations/personal-documents";
import { InputMask } from "@react-input/mask";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import type { Control, FieldValues, Path } from "react-hook-form";

type WithPersonalDocuments = FieldValues & {
  personal_documents?: PersonalDocumentsInput;
};

type PersonalDocumentsFieldsProps<TFieldValues extends WithPersonalDocuments> = {
  control: Control<TFieldValues>;
};

export default function PersonalDocumentsFields<TFieldValues extends WithPersonalDocuments>({
  control,
}: PersonalDocumentsFieldsProps<TFieldValues>) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <FormField
        control={control}
        name={"personal_documents.cpf" as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>CPF</FormLabel>
            <FormControl>
              <InputMask
                component={Input}
                mask="___.___.___-__"
                replacement={{ _: /\d/ }}
                placeholder="000.000.000-00"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"personal_documents.rg" as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>RG</FormLabel>
            <FormControl>
              <Input placeholder="00.000.000-0" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"personal_documents.rg_issuing_body" as Path<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Órgão emissor</FormLabel>
            <FormControl>
              <Input placeholder="SSP/SP" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
