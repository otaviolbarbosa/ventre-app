"use server";

import { authActionClient } from "@/lib/safe-action";
import { updateTag } from "next/cache";
import { z } from "zod";

export const invalidateUserCacheAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx: { user, profile } }) => {
    updateTag(`home-patients-${user.id}`);

    if (profile.enterprise_id) {
      updateTag(`enterprise-patients-${profile.enterprise_id}`);
    }

    return { success: true };
  });
