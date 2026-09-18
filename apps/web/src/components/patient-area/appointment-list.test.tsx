// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentWithProfessional } from "@/services/patient-self";
import AppointmentList from "./appointment-list";

function makeAppointment(overrides: Record<string, unknown> = {}): AppointmentWithProfessional {
  return {
    id: "appointment-1",
    date: "2026-12-25",
    time: "14:00:00",
    type: "consulta",
    status: "agendada",
    confirmed_by_patient_at: null,
    professional: { id: "prof-1", name: "Dra. Ana", professional_type: "obstetra" },
    ...overrides,
  } as unknown as AppointmentWithProfessional;
}

describe("AppointmentList", () => {
  const onRequestConfirm = vi.fn();
  const onRequestCancel = vi.fn();

  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when there are no appointments", () => {
    render(
      <AppointmentList
        appointments={[]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    expect(screen.getByText("Nenhuma consulta agendada.")).toBeInTheDocument();
  });

  it("shows both actions for an upcoming, unconfirmed appointment", () => {
    render(
      <AppointmentList
        appointments={[makeAppointment()]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "Confirmar presença" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento" })).toBeInTheDocument();
    expect(screen.queryByText("Confirmada")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelada")).not.toBeInTheDocument();
  });

  it("hides the confirm button and shows a badge once confirmed", () => {
    render(
      <AppointmentList
        appointments={[makeAppointment({ confirmed_by_patient_at: "2026-09-01T00:00:00Z" })]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    expect(screen.queryByRole("button", { name: "Confirmar presença" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar agendamento" })).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
  });

  it("hides both actions and shows a 'Cancelada' badge for a cancelled appointment, even if previously confirmed", () => {
    render(
      <AppointmentList
        appointments={[
          makeAppointment({ status: "cancelada", confirmed_by_patient_at: "2026-09-01T00:00:00Z" }),
        ]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    expect(screen.queryByRole("button", { name: "Confirmar presença" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).not.toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.queryByText("Confirmada")).not.toBeInTheDocument();
  });

  it("hides both actions for a past appointment", () => {
    render(
      <AppointmentList
        appointments={[makeAppointment({ date: "2020-01-01" })]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    expect(screen.queryByRole("button", { name: "Confirmar presença" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).not.toBeInTheDocument();
  });

  it("calls onRequestConfirm with the appointment (opens the confirmation modal) instead of confirming directly", async () => {
    const appointment = makeAppointment();
    const user = userEvent.setup();
    render(
      <AppointmentList
        appointments={[appointment]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirmar presença" }));

    expect(onRequestConfirm).toHaveBeenCalledWith(appointment);
  });

  it("calls onRequestCancel with the appointment when cancelling", async () => {
    const appointment = makeAppointment();
    const user = userEvent.setup();
    render(
      <AppointmentList
        appointments={[appointment]}
        onRequestConfirm={onRequestConfirm}
        onRequestCancel={onRequestCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar agendamento" }));

    expect(onRequestCancel).toHaveBeenCalledWith(appointment);
  });
});
