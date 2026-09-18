// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/patient-area/appointment-status-link-handler", () => ({
  AppointmentStatusLinkHandler: () => null,
}));
vi.mock("@/components/patient-area/appointment-list", () => ({
  default: ({
    appointments,
    onRequestConfirm,
    onRequestCancel,
  }: {
    appointments: { id: string }[];
    onRequestConfirm: (a: { id: string }) => void;
    onRequestCancel: (a: { id: string }) => void;
  }) => {
    const appointment = appointments[0] as { id: string };
    return (
      <div>
        <button type="button" onClick={() => onRequestConfirm(appointment)}>
          trigger-confirm
        </button>
        <button type="button" onClick={() => onRequestCancel(appointment)}>
          trigger-cancel
        </button>
      </div>
    );
  },
}));
vi.mock("@/modals/confirm-appointment-modal", () => ({
  ConfirmAppointmentModal: ({ appointment, open }: { appointment: unknown; open: boolean }) =>
    open ? <div>confirm-modal-open:{(appointment as { id: string })?.id}</div> : null,
}));
vi.mock("@/modals/cancel-appointment-modal", () => ({
  CancelAppointmentModal: ({ appointment, open }: { appointment: unknown; open: boolean }) =>
    open ? <div>cancel-modal-open:{(appointment as { id: string })?.id}</div> : null,
}));

import { PatientAgendaClient } from "./patient-agenda-client";

const appointments = [{ id: "appointment-1" }] as unknown as Parameters<
  typeof PatientAgendaClient
>[0]["appointments"];

describe("PatientAgendaClient", () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.clearAllMocks());

  it("opens the confirm modal for the requested appointment", async () => {
    const user = userEvent.setup();
    render(<PatientAgendaClient appointments={appointments} />);

    expect(screen.queryByText(/confirm-modal-open/)).not.toBeInTheDocument();

    await user.click(screen.getByText("trigger-confirm"));

    expect(screen.getByText("confirm-modal-open:appointment-1")).toBeInTheDocument();
    expect(screen.queryByText(/cancel-modal-open/)).not.toBeInTheDocument();
  });

  it("opens the cancel modal for the requested appointment", async () => {
    const user = userEvent.setup();
    render(<PatientAgendaClient appointments={appointments} />);

    await user.click(screen.getByText("trigger-cancel"));

    expect(screen.getByText("cancel-modal-open:appointment-1")).toBeInTheDocument();
    expect(screen.queryByText(/confirm-modal-open/)).not.toBeInTheDocument();
  });
});
