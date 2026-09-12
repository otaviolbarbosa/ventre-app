import { describe, expect, it } from "vitest";
import { isSubscriptionActive } from "./subscription";

const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

describe("isSubscriptionActive", () => {
  it("retorna false para null/undefined", () => {
    expect(isSubscriptionActive(null)).toBe(false);
    expect(isSubscriptionActive(undefined)).toBe(false);
  });

  it("retorna true para status active com expires_at no futuro", () => {
    expect(isSubscriptionActive({ status: "active", expires_at: future })).toBe(true);
  });

  it("retorna false para status active com expires_at no passado", () => {
    expect(isSubscriptionActive({ status: "active", expires_at: past })).toBe(false);
  });

  it("retorna false para status active sem expires_at", () => {
    expect(isSubscriptionActive({ status: "active", expires_at: null })).toBe(false);
  });

  it("retorna true para status canceling com expires_at no futuro", () => {
    expect(isSubscriptionActive({ status: "canceling", expires_at: future })).toBe(true);
  });

  it("retorna false para status canceling com expires_at no passado", () => {
    expect(isSubscriptionActive({ status: "canceling", expires_at: past })).toBe(false);
  });

  it("retorna false para status canceled mesmo com expires_at no futuro (ignora expires_at)", () => {
    expect(isSubscriptionActive({ status: "canceled", expires_at: future })).toBe(false);
  });

  it.each(["pending", "expired", "failed", "replaced"] as const)(
    "retorna false para status %s",
    (status) => {
      expect(isSubscriptionActive({ status, expires_at: future })).toBe(false);
    },
  );
});
