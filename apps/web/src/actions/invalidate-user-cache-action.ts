"use server";

import { authActionClient } from "@/lib/safe-action";
import { revalidateTag } from "next/cache";
import { z } from "zod";

export const invalidateUserCacheAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx: { user, profile } }) => {
    revalidateTag(`home-patients-${user.id}`, { expire: 300 });

    if (profile.enterprise_id) {
      revalidateTag(`enterprise-patients-${profile.enterprise_id}`, { expire: 300 });
    }

    return { success: true };
  });
