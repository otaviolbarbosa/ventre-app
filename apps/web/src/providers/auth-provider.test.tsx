// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";

const { supabaseMock } = vi.hoisted(() => {
  return {
    supabaseMock: {
      auth: {
        getUser: vi.fn(),
        onAuthStateChange: vi.fn(),
        updateUser: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

vi.mock("@ventre/supabase", () => ({ supabase: supabaseMock }));
vi.mock("@/actions/invalidate-user-cache-action", () => ({
  invalidateUserCacheAction: vi.fn(),
}));
vi.mock("@/actions/unsubscribe-notifications-action", () => ({
  unsubscribeNotificationsAction: vi.fn(),
}));
vi.mock("@/lib/native-bridge", () => ({
  isNativeBridge: () => false,
  hardNavigate: vi.fn(),
  requestNative: vi.fn(),
  NATIVE_PUSH_TOKEN_KEY: "native_push_token",
}));

function UpdatePasswordProbe() {
  const { updatePassword } = useAuth();
  const [result, setResult] = useState("idle");

  return (
    <div>
      <span data-testid="result">{result}</span>
      <button
        type="button"
        onClick={async () => {
          const { error } = await updatePassword("new-secret-pw");
          setResult(error ? "error" : "success");
        }}
      >
        trigger
      </button>
    </div>
  );
}

async function renderProbe() {
  render(
    <AuthProvider>
      <UpdatePasswordProbe />
    </AuthProvider>,
  );
  // Let the AuthProvider's mount effect (getUser + onAuthStateChange) settle
  // before interacting, otherwise React state updates land outside act().
  await waitFor(() => expect(supabaseMock.auth.getUser).toHaveBeenCalled());
}

describe("AuthProvider updatePassword", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("calls supabase.auth.updateUser with the new password", async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();

    await renderProbe();
    await user.click(screen.getByText("trigger"));

    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("success"));
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: "new-secret-pw" });
  });

  it("surfaces the error when supabase.auth.updateUser fails", async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({
      data: null,
      error: { message: "Auth session missing" },
    });
    const user = userEvent.setup();

    await renderProbe();
    await user.click(screen.getByText("trigger"));

    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("error"));
  });
});
