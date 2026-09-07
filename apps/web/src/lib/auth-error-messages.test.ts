import { describe, expect, it } from "vitest";
import { translateAuthError, translateAuthErrorCode } from "./auth-error-messages";

describe("translateAuthErrorCode", () => {
  it("translates a known code", () => {
    expect(translateAuthErrorCode("same_password")).toBe(
      "A nova senha deve ser diferente da senha atual.",
    );
  });

  it("translates the code behind the original bug report (expired/reused recovery link)", () => {
    expect(translateAuthErrorCode("otp_expired")).toBe(
      "O link de recuperação expirou ou já foi utilizado. Solicite um novo link.",
    );
  });

  it("returns undefined for an unknown code", () => {
    expect(translateAuthErrorCode("some_future_code_not_yet_mapped")).toBeUndefined();
  });

  it("returns undefined for null or missing codes", () => {
    expect(translateAuthErrorCode(null)).toBeUndefined();
    expect(translateAuthErrorCode(undefined)).toBeUndefined();
    expect(translateAuthErrorCode("")).toBeUndefined();
  });
});

describe("translateAuthError", () => {
  it("translates a Supabase AuthApiError-shaped object by its .code", () => {
    const error = { name: "AuthApiError", code: "weak_password", message: "Password is too weak" };

    expect(translateAuthError(error, "fallback")).toBe(
      "Senha muito fraca. Escolha uma senha mais forte.",
    );
  });

  it("falls back when the error has no code", () => {
    const error = new Error("network error");

    expect(translateAuthError(error, "Ocorreu um erro desconhecido.")).toBe(
      "Ocorreu um erro desconhecido.",
    );
  });

  it("falls back when the error's code isn't mapped", () => {
    const error = { code: "mfa_verification_failed" };

    expect(translateAuthError(error, "fallback")).toBe("fallback");
  });

  it("falls back for non-object errors", () => {
    expect(translateAuthError("just a string", "fallback")).toBe("fallback");
    expect(translateAuthError(null, "fallback")).toBe("fallback");
  });
});
