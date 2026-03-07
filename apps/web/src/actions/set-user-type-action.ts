"use server";

import { authActionClient } from "@/lib/safe-action";
import { setUserType } from "@/services/profile";
import type { Tables } from "@nascere/supabase/types";
import { z } from "zod";

type UserType = NonNullable<Tables<"users">["user_type"]>;

const userTypes = [
  "manager",
  "patient",
  "professional",
  "secretary",
] as const satisfies readonly UserType[];

const schema = z.object({
  type: z.enum(userTypes),
});

export const setUserTypeAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    await setUserType(supabase, user.id, parsedInput.type);
  });
