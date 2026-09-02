import { describe, expect, it } from "vitest";
import { buildPaymentLinkRedirectUrl } from "./stripe-payment-link-redirect";

describe("buildPaymentLinkRedirectUrl", () => {
  it("appends client_reference_id and prefilled_email to a bare payment link", () => {
    const url = buildPaymentLinkRedirectUrl({
      paymentLinkUrl: "https://buy.stripe.com/test_abc123",
      userId: "user-1",
      email: "maria@example.com",
    });

    expect(url).toBe(
      "https://buy.stripe.com/test_abc123?client_reference_id=user-1&prefilled_email=maria%40example.com",
    );
  });

  it("preserves existing query params on the payment link", () => {
    const url = buildPaymentLinkRedirectUrl({
      paymentLinkUrl: "https://buy.stripe.com/test_abc123?locale=pt-BR",
      userId: "user-2",
      email: "joao@example.com",
    });

    expect(url).toBe(
      "https://buy.stripe.com/test_abc123?locale=pt-BR&client_reference_id=user-2&prefilled_email=joao%40example.com",
    );
  });
});
