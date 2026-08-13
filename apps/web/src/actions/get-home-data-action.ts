"use server";

import { authActionClient } from "@/lib/safe-action";
import { getCachedHomeData } from "@/services/home-cache";

export const getHomeDataAction = authActionClient.action(async ({ ctx: { user } }) => {
  return await getCachedHomeData(user.id);
});
