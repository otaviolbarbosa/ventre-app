// @vitest-environment happy-dom
import type { Tables } from "@ventre/supabase";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useActionMock } = vi.hoisted(() => ({
  useActionMock: vi.fn(() => ({ execute: vi.fn(), executeAsync: vi.fn(), isExecuting: false })),
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("next-safe-action/hooks", () => ({ useAction: useActionMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@ventre/ui/hooks/use-confirmation-modal", () => ({
  useConfirmModal: () => ({ confirm: vi.fn() }),
}));
vi.mock("@ventre/supabase", () => ({ supabase: {} }));

import PaywallScreen from "./paywall-screen";

const plan = {
  id: "plan-1",
  name: "Mais Cuidado",
  description: "Para profissionais",
  benefits: ["Gestão financeira", "Relatórios detalhados"],
} as unknown as Tables<"plans">;

afterEach(() => {
  cleanup();
});

describe("PaywallScreen — trial days message", () => {
  it("does not show a trial message when the active payment link has no trial days", () => {
    render(
      <PaywallScreen plan={plan} monthPrice={9000} yearPrice={90000} monthTrialDays={0} />,
    );

    expect(screen.queryByText(/Teste gratuitamente/)).not.toBeInTheDocument();
  });

  it("shows the monthly trial days before the benefits list", () => {
    render(
      <PaywallScreen
        plan={plan}
        monthPrice={9000}
        yearPrice={90000}
        monthTrialDays={7}
        yearTrialDays={0}
      />,
    );

    expect(screen.getByText("Teste gratuitamente por 7 dias")).toBeInTheDocument();
  });

  it("switches to the yearly trial days when the annual toggle is selected", async () => {
    const user = userEvent.setup();
    render(
      <PaywallScreen
        plan={plan}
        monthPrice={9000}
        yearPrice={90000}
        monthTrialDays={7}
        yearTrialDays={14}
      />,
    );

    expect(screen.getByText("Teste gratuitamente por 7 dias")).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));

    expect(screen.queryByText("Teste gratuitamente por 7 dias")).not.toBeInTheDocument();
    expect(screen.getByText("Teste gratuitamente por 14 dias")).toBeInTheDocument();
  });
});
