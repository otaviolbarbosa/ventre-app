import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, appointmentRow, patientRow, updateResult, updateCalls } =
  vi.hoisted(() => ({
    authUser: { id: "patient-user-1" },
    profileRow: {
      data: { id: "patient-user-1", user_type: "patient" } as Record<string, unknown> | null,
      error: null,
    },
    ueRow: { data: null as { enterprise_id: string } | null, error: null },
    appointmentRow: {
      data: {
        id: "appointment-1",
        patient_id: "patient-1",
        date: "2026-12-25",
        time: "14:00:00",
        status: "agendada",
        confirmed_by_patient_at: null,
      } as Record<string, unknown> | null,
      error: null as unknown,
    },
    patientRow: { data: { id: "patient-1" } as Record<string, unknown> | null, error: null },
    updateResult: { error: null as { message: string } | null },
    updateCalls: [] as unknown[],
  }));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function makeAppointmentsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn((payload: unknown) => {
      updateCalls.push(payload);
      return builder;
    }),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(appointmentRow)),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder for the plain update() call
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "appointments") return makeAppointmentsBuilder();
      if (table === "patients") return makeQueryBuilder(patientRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { confirmAppointmentAttendanceAction } from "./confirm-appointment-attendance-action";

const appointmentId = "11111111-1111-1111-1111-111111111111";

describe("confirmAppointmentAttendanceAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    profileRow.data = { id: "patient-user-1", user_type: "patient" };
    appointmentRow.data = {
      id: "appointment-1",
      patient_id: "patient-1",
      date: "2026-12-25",
      time: "14:00:00",
      status: "agendada",
      confirmed_by_patient_at: null,
    };
    patientRow.data = { id: "patient-1" };
    updateResult.error = null;
    updateCalls.length = 0;
  });

  it("confirms attendance for the owning patient", async () => {
    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({ confirmed_by_patient_at: expect.any(String) });
  });

  it("rejects non-patient profiles", async () => {
    profileRow.data = { id: "patient-user-1", user_type: "professional" };

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBe("Apenas pacientes podem confirmar presença.");
    expect(updateCalls).toHaveLength(0);
  });

  it("errors when the appointment does not exist", async () => {
    appointmentRow.data = null;

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBe("Consulta não encontrada.");
    expect(updateCalls).toHaveLength(0);
  });

  it("errors when the appointment belongs to another patient", async () => {
    patientRow.data = null;

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBe("Você não tem permissão para confirmar esta consulta.");
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects confirming a cancelled appointment", async () => {
    appointmentRow.data = { ...appointmentRow.data, status: "cancelada" };

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBe("Esta consulta foi cancelada e não pode ser confirmada.");
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects confirming a past appointment", async () => {
    appointmentRow.data = { ...appointmentRow.data, date: "2020-01-01" };

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBe(
      "Não é possível confirmar presença em uma consulta que já passou.",
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("is idempotent when already confirmed", async () => {
    appointmentRow.data = {
      ...appointmentRow.data,
      confirmed_by_patient_at: "2025-12-01T00:00:00Z",
    };

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    expect(updateCalls).toHaveLength(0);
  });

  it("surfaces a server error when the update fails", async () => {
    updateResult.error = { message: "db error" };

    const res = await confirmAppointmentAttendanceAction({ appointmentId });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
