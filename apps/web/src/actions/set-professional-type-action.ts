"use server";

import { authActionClient } from "@/lib/safe-action";
import { setProfessionalType } from "@/services/profile";
import type { Tables } from "@ventre/supabase/types";
import { redirect } from "next/navigation";
import { z } from "zod";

type ProfessionalType = NonNullable<Tables<"users">["professional_type"]>;

const professionalTypes = [
  "obstetra",
  "enfermeiro",
  "doula",
] as const satisfies readonly ProfessionalType[];

const schema = z.object({
  type: z.enum(professionalTypes),
});

export const setProfessionalTypeAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    await setProfessionalType(supabase, user.id, parsedInput.type);
    redirect("/home");
  });
