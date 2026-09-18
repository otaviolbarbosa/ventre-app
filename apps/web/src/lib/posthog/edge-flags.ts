import type { CookieOptions } from "@supabase/ssr";

export const DISABLE_SUBSCRIPTION_ACCESS_FLAG = "disable_subscription_access";

const CACHE_COOKIE_NAME = "vt_dsa_flag";
const CACHE_TTL_SECONDS = 120;

const CACHE_COOKIE_OPTIONS: CookieOptions = {
  maxAge: CACHE_TTL_SECONDS,
  path: "/",
  sameSite: "lax",
  httpOnly: true,
};

export type FlagCookie = { name: string; value: string; options: CookieOptions };

async function fetchFlagFromPostHog(distinctId: string, flagKey: string): Promise<boolean> {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!host || !token) return false;

  try {
    const res = await fetch(`${host}/flags/?v=2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, distinct_id: distinctId }),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { flags?: Record<string, { enabled?: boolean }> };
    return data.flags?.[flagKey]?.enabled === true;
  } catch {
    // PostHog unreachable — fail closed: keep the subscription requirement enforced
    // rather than accidentally letting everyone through on an outage.
    return false;
  }
}

/**
 * Resolves the disable_subscription_access kill-switch, caching the result in a
 * short-lived cookie (120s) so most navigations skip the network round-trip to
 * PostHog entirely — it's a global on/off toggle (100% rollout, no per-user
 * targeting), so a couple of minutes of staleness after a manual flip is fine.
 */
export async function resolveDisableSubscriptionAccessFlag(
  existingCookieValue: string | undefined,
  distinctId: string,
): Promise<{ enabled: boolean; freshCookie: FlagCookie | null }> {
  if (existingCookieValue === "1" || existingCookieValue === "0") {
    return { enabled: existingCookieValue === "1", freshCookie: null };
  }

  const enabled = await fetchFlagFromPostHog(distinctId, DISABLE_SUBSCRIPTION_ACCESS_FLAG);
  return {
    enabled,
    freshCookie: {
      name: CACHE_COOKIE_NAME,
      value: enabled ? "1" : "0",
      options: CACHE_COOKIE_OPTIONS,
    },
  };
}

export function readCachedFlagCookie(cookies: {
  get(name: string): { value: string } | undefined;
}) {
  return cookies.get(CACHE_COOKIE_NAME)?.value;
}
