import { describe, expect, it } from "vitest";
import { isSpoofedCheckoutEmail, resolveCheckoutSource } from "./webhook-checkout-source";

describe("resolveCheckoutSource", () => {
  it("resolves plan/frequence from the payment link when session.payment_link matched one", () => {
    const result = resolveCheckoutSource({
      metadata: {},
      clientReferenceId: "user-123",
      paymentLinkPlan: { planId: "plan-abc", frequence: "year" },
    });

    expect(result).toEqual({
      userId: "user-123",
      enterpriseId: null,
      planId: "plan-abc",
      frequence: "year",
    });
  });

  it("falls back to metadata when there is no payment link (dynamic checkout path)", () => {
    const result = resolveCheckoutSource({
      metadata: { user_id: "user-456", plan_id: "plan-def", frequence: "month" },
      clientReferenceId: null,
      paymentLinkPlan: null,
    });

    expect(result).toEqual({
      userId: "user-456",
      enterpriseId: null,
      planId: "plan-def",
      frequence: "month",
    });
  });

  it("prefers metadata.user_id over client_reference_id when both are present", () => {
    const result = resolveCheckoutSource({
      metadata: { user_id: "user-from-metadata" },
      clientReferenceId: "user-from-client-ref",
      paymentLinkPlan: { planId: "plan-abc", frequence: "month" },
    });

    expect(result?.userId).toBe("user-from-metadata");
  });

  it("resolves enterprise_id from metadata regardless of payment link presence", () => {
    const result = resolveCheckoutSource({
      metadata: { enterprise_id: "ent-1", plan_id: "plan-def", frequence: "month" },
      clientReferenceId: null,
      paymentLinkPlan: null,
    });

    expect(result?.enterpriseId).toBe("ent-1");
    expect(result?.userId).toBeNull();
  });

  it("returns null when neither a payment link nor metadata plan_id/frequence resolve", () => {
    const result = resolveCheckoutSource({
      metadata: {},
      clientReferenceId: "user-123",
      paymentLinkPlan: null,
    });

    expect(result).toBeNull();
  });
});

describe("isSpoofedCheckoutEmail", () => {
  it("returns false when both emails match (case-insensitive)", () => {
    expect(
      isSpoofedCheckoutEmail({
        resolvedUserEmail: "Person@Example.com",
        payingCustomerEmail: "person@example.com",
      }),
    ).toBe(false);
  });

  it("returns true when the paying customer's email differs from the resolved user's email", () => {
    expect(
      isSpoofedCheckoutEmail({
        resolvedUserEmail: "victim@example.com",
        payingCustomerEmail: "attacker@example.com",
      }),
    ).toBe(true);
  });

  it("returns false when the resolved user has no stored email", () => {
    expect(
      isSpoofedCheckoutEmail({
        resolvedUserEmail: null,
        payingCustomerEmail: "attacker@example.com",
      }),
    ).toBe(false);
  });

  it("returns false when Stripe did not record a customer email", () => {
    expect(
      isSpoofedCheckoutEmail({
        resolvedUserEmail: "victim@example.com",
        payingCustomerEmail: null,
      }),
    ).toBe(false);
  });

  it("returns false when both emails are missing", () => {
    expect(isSpoofedCheckoutEmail({ resolvedUserEmail: null, payingCustomerEmail: null })).toBe(
      false,
    );
  });
});
