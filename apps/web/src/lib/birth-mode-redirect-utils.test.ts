import { describe, expect, it } from "vitest";
import { canConsiderAutoRedirect, resolveAutoRedirectPregnancyId } from "./birth-mode-redirect-utils";

describe("canConsiderAutoRedirect", () => {
  const baseInput = {
    isProfessional: true,
    birthModeDisabled: false,
    pathname: "/home",
    activePregnancyIds: ["pregnancy-1"],
  };

  it("retorna true no caso feliz", () => {
    expect(canConsiderAutoRedirect(baseInput)).toBe(true);
  });

  it("retorna false quando o usuário não é profissional", () => {
    expect(canConsiderAutoRedirect({ ...baseInput, isProfessional: false })).toBe(false);
  });

  it("retorna false quando o modo parto está desabilitado (doula + flag)", () => {
    expect(canConsiderAutoRedirect({ ...baseInput, birthModeDisabled: true })).toBe(false);
  });

  it("retorna false quando não há partos ativos", () => {
    expect(canConsiderAutoRedirect({ ...baseInput, activePregnancyIds: [] })).toBe(false);
  });

  it("retorna false quando já está em /modo-parto", () => {
    expect(canConsiderAutoRedirect({ ...baseInput, pathname: "/modo-parto" })).toBe(false);
  });

  it("retorna false quando já está em /modo-parto?pregnancyId=x", () => {
    expect(
      canConsiderAutoRedirect({ ...baseInput, pathname: "/modo-parto?pregnancyId=x" }),
    ).toBe(false);
  });
});

describe("resolveAutoRedirectPregnancyId", () => {
  it("retorna null para lista vazia", () => {
    expect(resolveAutoRedirectPregnancyId([])).toBeNull();
  });

  it("retorna o primeiro id da lista", () => {
    expect(resolveAutoRedirectPregnancyId(["a", "b"])).toBe("a");
  });
});
