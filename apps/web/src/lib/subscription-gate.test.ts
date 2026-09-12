import type { UserProfile } from "@/lib/server-auth";
import { describe, expect, it } from "vitest";
import { shouldRedirectToPaywall } from "./subscription-gate";

const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function buildProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_type: "professional",
    professional_type: "doula",
    enterprise_id: null,
    ...overrides,
  } as UserProfile;
}

const activeSubscription = { status: "active" as const, expires_at: future };

describe("shouldRedirectToPaywall", () => {
  it("não redireciona gestante mesmo sem assinatura", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile({ user_type: "patient" }),
        subscription: null,
        bypassFlagEnabled: false,
      }),
    ).toBe(false);
  });

  it("não redireciona admin mesmo sem assinatura", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile({ user_type: "admin" }),
        subscription: null,
        bypassFlagEnabled: false,
      }),
    ).toBe(false);
  });

  it("não redireciona profissional que ainda não terminou onboarding (professional_type nulo)", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile({ professional_type: null }),
        subscription: null,
        bypassFlagEnabled: false,
      }),
    ).toBe(false);
  });

  it("redireciona profissional onboarded sem assinatura ativa", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile(),
        subscription: null,
        bypassFlagEnabled: false,
      }),
    ).toBe(true);
  });

  it("não redireciona profissional com assinatura ativa", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile(),
        subscription: activeSubscription,
        bypassFlagEnabled: false,
      }),
    ).toBe(false);
  });

  it("não redireciona quando a flag de bypass está ligada", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile(),
        subscription: null,
        bypassFlagEnabled: true,
      }),
    ).toBe(false);
  });

  it("redireciona staff sem enterprise mesmo com a flag desligada (nunca termina onboarding)", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile({ user_type: "manager", enterprise_id: null }),
        subscription: null,
        bypassFlagEnabled: false,
      }),
    ).toBe(false);
  });

  it("redireciona staff com enterprise e sem assinatura ativa", () => {
    expect(
      shouldRedirectToPaywall({
        profile: buildProfile({ user_type: "secretary", enterprise_id: "ent-1" }),
        subscription: null,
        bypassFlagEnabled: false,
      }),
    ).toBe(true);
  });
});
