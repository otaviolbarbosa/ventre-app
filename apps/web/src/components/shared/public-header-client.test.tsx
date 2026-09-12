// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ signOut: signOutMock }) }));

import { PublicHeaderClient } from "./public-header-client";

afterEach(() => {
  cleanup();
  signOutMock.mockClear();
});

describe("PublicHeaderClient", () => {
  it("shows 'Entrar'/'Cadastrar' when there's no logged-in user", () => {
    render(<PublicHeaderClient />);

    expect(screen.getAllByRole("link", { name: "Entrar" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("shows 'Acessar Painel' for a logged-in user with an active subscription", () => {
    render(<PublicHeaderClient userId="user-1" hasActiveSubscription={true} />);

    expect(screen.getAllByRole("link", { name: /Acessar Painel/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("shows 'Sair' for a logged-in user without an active subscription", async () => {
    const user = userEvent.setup();
    render(<PublicHeaderClient userId="user-1" hasActiveSubscription={false} />);

    const signOutButtons = screen.getAllByRole("button", { name: "Sair" });
    expect(signOutButtons.length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Acessar Painel/ })).not.toBeInTheDocument();

    const [firstSignOutButton] = signOutButtons;
    if (!firstSignOutButton) throw new Error("expected a 'Sair' button to be rendered");

    await user.click(firstSignOutButton);
    expect(signOutMock).toHaveBeenCalled();
  });
});
