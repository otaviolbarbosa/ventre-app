import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDisableSubscriptionAccessFlag } from "./edge-flags";

const originalFetch = global.fetch;

describe("resolveDisableSubscriptionAccessFlag", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("usa o cookie em cache sem chamar o PostHog", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await resolveDisableSubscriptionAccessFlag("1", "user-1");

    expect(result).toEqual({ enabled: true, freshCookie: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("interpreta o cookie '0' como flag desligada, sem chamar o PostHog", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await resolveDisableSubscriptionAccessFlag("0", "user-1");

    expect(result).toEqual({ enabled: false, freshCookie: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("busca no PostHog quando não há cookie, e devolve um cookie novo pra cachear", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ featureFlags: { disable_subscription_access: true } }),
    }) as unknown as typeof fetch;

    const result = await resolveDisableSubscriptionAccessFlag(undefined, "user-1");

    expect(result.enabled).toBe(true);
    expect(result.freshCookie).toMatchObject({ name: "vt_dsa_flag", value: "1" });
    expect(result.freshCookie?.options.maxAge).toBe(120);
  });

  it("retorna false (fail closed) quando a chamada ao PostHog falha", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await resolveDisableSubscriptionAccessFlag(undefined, "user-1");

    expect(result.enabled).toBe(false);
    expect(result.freshCookie).toMatchObject({ value: "0" });
  });

  it("retorna false (fail closed) quando o PostHog responde com erro HTTP", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const result = await resolveDisableSubscriptionAccessFlag(undefined, "user-1");

    expect(result.enabled).toBe(false);
  });

  it("retorna false sem chamar fetch quando as env vars do PostHog não estão configuradas", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "";
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await resolveDisableSubscriptionAccessFlag(undefined, "user-1");

    expect(result.enabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
