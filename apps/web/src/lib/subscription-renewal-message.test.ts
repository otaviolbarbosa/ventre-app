import { describe, expect, it } from "vitest";
import { getSubscriptionRenewalMessage } from "./subscription-renewal-message";

describe("getSubscriptionRenewalMessage", () => {
  it.each([
    ["canceled", /cancelada/i],
    ["expired", /expirou/i],
    ["failed", /pagamento/i],
    ["canceling", /período/i],
    ["pending", /confirmada/i],
    ["replaced", /não está mais ativa/i],
  ] as const)("retorna mensagem para status %s", (status, expected) => {
    expect(getSubscriptionRenewalMessage(status)).toMatch(expected);
  });
});
