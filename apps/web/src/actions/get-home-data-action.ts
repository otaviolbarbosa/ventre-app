"use server";

import { authActionClient } from "@/lib/safe-action";
import { getCachedHomeData } from "@/services/home";
import { z } from "zod";

export const getHomeDataAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx: { user } }) => {
    return await getCachedHomeData(user.id);
  });
