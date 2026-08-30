import {
  DISABILITY_TYPE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  type PartnerInput,
  RACE_COLOR_OPTIONS,
  TRADITIONAL_COMMUNITY_TYPE_OPTIONS,
} from "@/lib/validations/partner";
import { Checkbox } from "@ventre/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { DatePicker } from "@ventre/ui/shared/date-picker";
import type { Control, Path } from "react-hook-form";
import { useController, useWatch } from "react-hook-form";

// Kept as a standalone shape (instead of a generic over the host form) so this
// component doesn't drag the large CreatePatientInput/PatientSelfRegistrationInput
// types into zodResolver's inference — that combination hits TS's
// "type instantiation is excessively deep" limit. Callers cast form.control.
export type PartnerFormValues = { partner?: PartnerInput };

function toggleValue(current: string | undefined, value: string): string {
  const list = current ? current.split(",").filter(Boolean) : [];
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return next.join(",");
}

export function PartnerFormFields({ control }: { control: Control<PartnerFormValues> }) {
  const path = (name: keyof PartnerInput) => `partner.${name}` as Path<PartnerFormValues>;
  const hasTraditionalCommunity = useWatch({ control, name: path("traditional_community") });
  const traditionalCommunityTypes = useWatch({
    control,
    name: path("traditional_community_types"),
  });
  const hasTraditionalCommunityOthers = (traditionalCommunityTypes ?? "")
    .split(",")
    .includes("outro");
  const hasDisability = useWatch({ control, name: path("has_disability") });
  const disabilityTypes = useWatch({ control, name: path("disability_types") });
  const hasDisabilityOther = (disabilityTypes ?? "").split(",").includes("outra");

  const { field: traditionalCommunityTypesField } = useController({
    control,
    name: path("traditional_community_types"),
  });
  const { field: traditionalCommunityOtherField } = useController({
    control,
    name: path("traditional_community_other"),
  });
  const { field: disabilityTypesField } = useController({ control, name: path("disability_types") });
  const { field: disabilityOtherField } = useController({ control, name: path("disability_other") });

  function handleTraditionalCommunityChange(checked: boolean) {
    if (!checked) {
      traditionalCommunityTypesField.onChange("");
      traditionalCommunityOtherField.onChange("");
    }
  }

  function handleHasDisabilityChange(checked: boolean) {
    if (!checked) {
      disabilityTypesField.onChange("");
      disabilityOtherField.onChange("");
    }
  }

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name={path("full_name")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome completo</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={path("preferred_name")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Como gosta de ser chamado(a) / Nome social</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={path("birth_date")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de nascimento</FormLabel>
              <FormControl>
                <DatePicker
                  selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                  onChange={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
                  placeholderText="Selecione a data"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={path("gender_identity")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Identidade de gênero</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={path("traditional_community")}
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value ?? false}
                onCheckedChange={(checked) => {
                  field.onChange(checked);
                  handleTraditionalCommunityChange(checked === true);
                }}
              />
            </FormControl>
            <FormLabel className="font-normal">
              Pertence a povos e/ou comunidades tradicionais
            </FormLabel>
          </FormItem>
        )}
      />

      {hasTraditionalCommunity && (
        <FormField
          control={control}
          name={path("traditional_community_types")}
          render={({ field }) => {
            const selected = (field.value ?? "").split(",").filter(Boolean);
            return (
              <FormItem>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TRADITIONAL_COMMUNITY_TYPE_OPTIONS.map((opt) => (
                    <FormItem key={opt.value} className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={selected.includes(opt.value)}
                          onCheckedChange={() =>
                            field.onChange(toggleValue(field.value, opt.value))
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{opt.label}</FormLabel>
                    </FormItem>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      )}
      {hasTraditionalCommunityOthers && (
        <FormField
          control={control}
          name={path("traditional_community_other")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Outro(a) — qual?</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name={path("race_color")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Raça/cor (autodeclaração)</FormLabel>
            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {RACE_COLOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={path("has_disability")}
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value ?? false}
                onCheckedChange={(checked) => {
                  field.onChange(checked);
                  handleHasDisabilityChange(checked === true);
                }}
              />
            </FormControl>
            <FormLabel className="font-normal">Tem alguma deficiência</FormLabel>
          </FormItem>
        )}
      />

      {hasDisability && (
        <>
          <FormField
            control={control}
            name={path("disability_types")}
            render={({ field }) => {
              const selected = (field.value ?? "").split(",").filter(Boolean);
              return (
                <FormItem>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DISABILITY_TYPE_OPTIONS.map((opt) => (
                      <FormItem key={opt.value} className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={selected.includes(opt.value)}
                            onCheckedChange={() =>
                              field.onChange(toggleValue(field.value, opt.value))
                            }
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{opt.label}</FormLabel>
                      </FormItem>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {hasDisabilityOther && (
            <FormField
              control={control}
              name={path("disability_other")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outra — qual?</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </>
      )}

      <FormField
        control={control}
        name={path("education_level")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Qual foi o nível educacional mais elevado que você frequentou?</FormLabel>
            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <p className="font-medium text-sm">Antecedentes familiares</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["family_history_diabetes", "Diabetes mellitus"],
            ["family_history_hypertension", "Hipertensão arterial"],
            ["family_history_twin_pregnancy", "Gemelar ou múltipla"],
          ] as const
        ).map(([name, label]) => (
          <FormField
            key={name}
            control={control}
            name={path(name)}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">{label}</FormLabel>
              </FormItem>
            )}
          />
        ))}
      </div>

      <FormField
        control={control}
        name={path("family_history_other")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Outros</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
