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
vi.mock("@/actions/cancel-appointment-action", () => ({
  cancelAppointmentAction: "cancel-appointment-action",
}));

import { CancelAppointmentModal } from "./cancel-appointment-modal";

const appointment = {
  id: "appointment-1",
  date: "2026-12-25",
  time: "14:00:00",
  type: "consulta",
  status: "agendada",
  confirmed_by_patient_at: null,
  professional: null,
} as unknown as Parameters<typeof CancelAppointmentModal>[0]["appointment"];

describe("CancelAppointmentModal", () => {
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
      <CancelAppointmentModal
        appointment={null}
        open={false}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the appointment date/time and submits the reason and reschedule checkbox", async () => {
    const user = userEvent.setup();
    render(
      <CancelAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText("Consulta de 25/12/2026 às 14:00")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Conte pra gente o que aconteceu"),
      "Imprevisto de trabalho",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith({
        appointmentId: "appointment-1",
        reason: "Imprevisto de trabalho",
        requestReschedule: true,
      }),
    );
  });

  it("submits without a reason when left blank", async () => {
    const user = userEvent.setup();
    render(
      <CancelAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith({
        appointmentId: "appointment-1",
        reason: "",
        requestReschedule: false,
      }),
    );
  });

  it("closes the modal without submitting when clicking Voltar", async () => {
    const user = userEvent.setup();
    render(
      <CancelAppointmentModal
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
      <CancelAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    onSuccessCallback?.();

    expect(toastMock.success).toHaveBeenCalledWith("Agendamento cancelado.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("shows a friendly error toast on failure", () => {
    render(
      <CancelAppointmentModal
        appointment={appointment}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    onErrorCallback?.({
      error: { serverError: "Não é possível cancelar uma consulta que já passou." },
    });

    expect(toastMock.error).toHaveBeenCalledWith(
      "Não é possível cancelar uma consulta que já passou.",
    );
  });
});
