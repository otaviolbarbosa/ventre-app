// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useActionMock, executeMock, toastMock, routerRefreshMock } = vi.hoisted(() => ({
  useActionMock: vi.fn(),
  executeMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
  routerRefreshMock: vi.fn(),
}));

vi.mock("next-safe-action/hooks", () => ({ useAction: useActionMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: routerRefreshMock }) }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/actions/confirm-appointment-attendance-action", () => ({
  confirmAppointmentAttendanceAction: "confirm-appointment-attendance-action",
}));

import { ConfirmAppointmentModal } from "./confirm-appointment-modal";

const appointment = {
  id: "appointment-1",
  date: "2026-12-25",
  time: "14:00:00",
  type: "consulta",
  status: "agendada",
  confirmed_by_patient_at: null,
  professional: null,
} as unknown as Parameters<typeof ConfirmAppointmentModal>[0]["appointment"];

describe("ConfirmAppointmentModal", () => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  let onSuccessCallback: (() => void) | undefined;
  let onErrorCallback: ((args: { error: { serverError?: string } }) => void) | undefined;

  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    useActionMock.mockImplementation((_action, handlers) => {
      onSuccessCallback = handlers?.onSuccess;
      onErrorCallback = handlers?.onError;
      return { execute: executeMock, status: "idle" };
    });
  });

  it("renders nothing when there is no appointment", () => {
    const { container } = render(
      <ConfirmAppointmentModal
        appointment={null}
        open={false}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the appointment date/time and asks for confirmation before executing", () => {
    render(
      <ConfirmAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText("Consulta de 25/12/2026 às 14:00")).toBeInTheDocument();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("executes the confirm action with the appointment id when confirmed", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirmar presença" }));

    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith({ appointmentId: "appointment-1" }),
    );
  });

  it("closes the modal without executing when clicking Voltar", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("shows a success toast, closes the modal and refreshes on success", () => {
    render(
      <ConfirmAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    onSuccessCallback?.();

    expect(toastMock.success).toHaveBeenCalledWith("Presença confirmada!");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("shows a friendly error toast on failure", () => {
    render(
      <ConfirmAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    onErrorCallback?.({
      error: { serverError: "Não é possível confirmar presença em uma consulta que já passou." },
    });

    expect(toastMock.error).toHaveBeenCalledWith(
      "Não é possível confirmar presença em uma consulta que já passou.",
    );
  });
});
