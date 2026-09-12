import { describe, expect, it } from "vitest";
import { canPurchaseFromPaywall, getPaywallUnavailableMessage } from "./paywall-access";

describe("canPurchaseFromPaywall", () => {
  it("permite visitante deslogado (null)", () => {
    expect(canPurchaseFromPaywall(null)).toBe(true);
  });

  it("permite profissional", () => {
    expect(canPurchaseFromPaywall("professional")).toBe(true);
  });

  it("esconde para gestante", () => {
    expect(canPurchaseFromPaywall("patient")).toBe(false);
  });

  it("esconde para manager", () => {
    expect(canPurchaseFromPaywall("manager")).toBe(false);
  });

  it("esconde para secretary", () => {
    expect(canPurchaseFromPaywall("secretary")).toBe(false);
  });

  it("esconde para admin", () => {
    expect(canPurchaseFromPaywall("admin")).toBe(false);
  });
});

describe("getPaywallUnavailableMessage", () => {
  it("mensagem específica pra gestante", () => {
    expect(getPaywallUnavailableMessage("patient")).toMatch(/acesso gratuito/i);
  });

  it("mensagem específica pra staff (manager/secretary)", () => {
    expect(getPaywallUnavailableMessage("manager")).toMatch(/equipes/i);
    expect(getPaywallUnavailableMessage("secretary")).toMatch(/equipes/i);
  });

  it("mensagem genérica pra outros casos (ex: admin)", () => {
    expect(getPaywallUnavailableMessage("admin")).toMatch(/não disponível/i);
  });
});
