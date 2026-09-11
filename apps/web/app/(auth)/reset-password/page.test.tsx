// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updatePasswordMock, signOutMock, toastMock } = vi.hoisted(() => ({
  updatePasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ updatePassword: updatePasswordMock, signOut: signOutMock }),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import ResetPasswordPage from "./page";

async function fillAndSubmit(password: string, confirmPassword: string) {
  const user = userEvent.setup();
  const { container } = render(<ResetPasswordPage />);

  // FormControl's Slot forwards id/aria-* to the wrapping `<div className="relative">`
  // (needed so the eye-toggle button sits inside it), not to the `<input>` itself, so the
  // FormLabel's htmlFor doesn't resolve to a labellable element here — same pattern as
  // login/page.tsx and register/page.tsx. Querying by `name` matches the real DOM instead.
  const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');
  const confirmInput = container.querySelector<HTMLInputElement>('input[name="confirmPassword"]');
  if (!passwordInput || !confirmInput) throw new Error("password inputs not found");

  await user.type(passwordInput, password);
  await user.type(confirmInput, confirmPassword);
  await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

  return user;
}

describe("ResetPasswordPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a validation error when the passwords don't match", async () => {
    await fillAndSubmit("senha123", "senha456");

    expect(await screen.findByText("As senhas não coincidem")).toBeInTheDocument();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("updates the password and signs out to force a fresh login", async () => {
    updatePasswordMock.mockResolvedValue({ data: { user: {} }, error: null });

    await fillAndSubmit("senha123", "senha123");

    await waitFor(() => expect(updatePasswordMock).toHaveBeenCalledWith("senha123"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    // The recovery session's "recovery" amr claim persists across updateUser() within the
    // same session (proxy.ts would keep confining it to /reset-password), so success must
    // sign out and send the user back to /login to authenticate fresh with the new password.
    await waitFor(() => expect(signOutMock).toHaveBeenCalledWith("/login?passwordReset=success"));
  });

  it("shows an error toast and does not sign out when updatePassword fails", async () => {
    updatePasswordMock.mockResolvedValue({
      data: null,
      error: { message: "Auth session missing" },
    });

    await fillAndSubmit("senha123", "senha123");

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("shows the PT-BR translation for a coded Supabase error (e.g. same_password)", async () => {
    updatePasswordMock.mockResolvedValue({
      data: null,
      error: {
        code: "same_password",
        message: "New password should be different from the old password.",
      },
    });

    await fillAndSubmit("senha123", "senha123");

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Erro ao redefinir senha",
        expect.objectContaining({ description: "A nova senha deve ser diferente da senha atual." }),
      ),
    );
  });

  it("lets the user cancel and sign out instead of being stuck on this page", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.click(screen.getByRole("button", { name: /cancelar e voltar para o login/i }));

    // proxy.ts confines a recovery session to /reset-password — signing out is the only
    // way for the user to reach /login, /register or the landing page again.
    await waitFor(() => expect(signOutMock).toHaveBeenCalledWith("/login"));
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });
});
