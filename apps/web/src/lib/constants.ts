import type { Enums } from "@nascere/supabase";

export const PATIENTS_PER_PAGE = 10;

export const PREGNANCY_DELIVERY_METHOD: Record<Enums<"delivery_method">, string> = {
  cesarean: "Cesárea",
  vaginal: "Parto Normal",
};
