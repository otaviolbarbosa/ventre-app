// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useActionMock, executeConfirmMock, routerReplaceMock, toastMock, searchParamsRef } =
  vi.hoisted(() => ({
    useActionMock: vi.fn(),
    executeConfirmMock: vi.fn(),
    routerReplaceMock: vi.fn(),
    toastMock: { success: vi.fn(), error: vi.fn() },
    searchParamsRef: { current: new URLSearchParams() },
  }));

vi.mock("next-safe-action/hooks", () => ({ useAction: useActionMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  useSearchParams: () => searchParamsRef.current,
}));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/actions/confirm-appointment-attendance-action", () => ({
  confirmAppointmentAttendanceAction: "confirm-appointment-attendance-action",
}));

import { AppointmentStatusLinkHandler } from "./appointment-status-link-handler";

const appointmentId = "11111111-1111-1111-1111-111111111111";
const appointments = [
  {
    id: appointmentId,
    date: "2026-12-25",
    time: "14:00:00",
    type: "consulta",
    status: "agendada",
    confirmed_by_patient_at: null,
    professional: null,
  },
] as unknown as Parameters<typeof AppointmentStatusLinkHandler>[0]["appointments"];

describe("AppointmentStatusLinkHandler", () => {
  const onRequestCancel = vi.fn();

  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsRef.current = new URLSearchParams();
    useActionMock.mockImplementation(() => ({ execute: executeConfirmMock }));
  });

  it("does nothing when there are no link params", () => {
    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    expect(executeConfirmMock).not.toHaveBeenCalled();
    expect(onRequestCancel).not.toHaveBeenCalled();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it("confirms attendance when status=confirmada for an owned appointment", async () => {
    searchParamsRef.current = new URLSearchParams({ status: "confirmada", aid: appointmentId });

    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    await waitFor(() => expect(executeConfirmMock).toHaveBeenCalledWith({ appointmentId }));
    expect(onRequestCancel).not.toHaveBeenCalled();
  });

  it("opens the cancel modal when status=cancelada for an owned appointment", async () => {
    searchParamsRef.current = new URLSearchParams({ status: "cancelada", aid: appointmentId });

    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    await waitFor(() => expect(onRequestCancel).toHaveBeenCalledWith(appointments[0]));
    expect(executeConfirmMock).not.toHaveBeenCalled();
    expect(routerReplaceMock).toHaveBeenCalledWith("/agenda");
  });

  it("shows a friendly error and cleans the URL for a malformed appointment id", async () => {
    searchParamsRef.current = new URLSearchParams({ status: "confirmada", aid: "not-a-uuid" });

    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Link inválido."));
    expect(routerReplaceMock).toHaveBeenCalledWith("/agenda");
    expect(executeConfirmMock).not.toHaveBeenCalled();
    expect(onRequestCancel).not.toHaveBeenCalled();
  });

  it("shows a friendly error for an unknown status value", async () => {
    searchParamsRef.current = new URLSearchParams({ status: "invalida", aid: appointmentId });

    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Link inválido."));
    expect(executeConfirmMock).not.toHaveBeenCalled();
    expect(onRequestCancel).not.toHaveBeenCalled();
  });

  it("shows a friendly error when the appointment does not belong to this patient", async () => {
    const foreignId = "22222222-2222-2222-2222-222222222222";
    searchParamsRef.current = new URLSearchParams({ status: "confirmada", aid: foreignId });

    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Agendamento não encontrado."),
    );
    expect(routerReplaceMock).toHaveBeenCalledWith("/agenda");
    expect(executeConfirmMock).not.toHaveBeenCalled();
  });

  it("shows a friendly error when aid is missing", async () => {
    searchParamsRef.current = new URLSearchParams({ status: "confirmada" });

    render(
      <AppointmentStatusLinkHandler
        appointments={appointments}
        onRequestCancel={onRequestCancel}
      />,
    );

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Link inválido."));
    expect(executeConfirmMock).not.toHaveBeenCalled();
  });
});
