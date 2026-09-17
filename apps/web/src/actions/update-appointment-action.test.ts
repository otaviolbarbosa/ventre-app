import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, previousAppointment, updatedAppointment, enqueueCalls } =
  vi.hoisted(() => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
      error: null,
    },
    ueRow: { data: null as { enterprise_id: string } | null, error: null },
    previousAppointment: {
      data: { date: "2026-12-25", time: "14:00", patient_id: "patient-1" } as {
        date: string;
        time: string;
        patient_id: string;
      } | null,
      error: null as unknown,
    },
    updatedAppointment: {
      data: {
        id: "appointment-1",
        date: "2026-12-25",
        time: "14:00",
        patient_id: "patient-1",
        patient: { name: "Maria" },
      } as Record<string, unknown> | null,
      error: null as unknown,
    },
    enqueueCalls: [] as unknown[],
  }));

let appointmentsFromCallCount = 0;

// The action calls supabase.from("appointments") three times in sequence: (1) select the
// pre-update row, (2) update it, (3) select the post-update row — each call needs a distinct
// mock response, tracked here by call order rather than per-builder state.
function makeAppointmentsBuilder() {
  appointmentsFromCallCount += 1;
  const callNumber = appointmentsFromCallCount;
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() =>
      Promise.resolve(callNumber === 1 ? previousAppointment : updatedAppointment),
    ),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder for the plain update() call
    then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
  };
  return builder;
}

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

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "appointments") return makeAppointmentsBuilder();
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/notifications/queue", () => ({
  enqueueNotification: vi.fn((params: unknown) => {
    enqueueCalls.push(params);
    return Promise.resolve(1);
  }),
}));
vi.mock("@/lib/activity-log", () => ({ insertActivityLog: vi.fn() }));
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/google-calendar", () => ({
  syncUpdateToGoogleCalendar: vi.fn().mockResolvedValue(undefined),
}));

import { updateAppointmentAction } from "./update-appointment-action";

describe("updateAppointmentAction", () => {
  beforeEach(() => {
    appointmentsFromCallCount = 0;
    ueRow.data = null;
    previousAppointment.data = { date: "2026-12-25", time: "14:00", patient_id: "patient-1" };
    updatedAppointment.data = {
      id: "appointment-1",
      date: "2026-12-25",
      time: "14:00",
      patient_id: "patient-1",
      patient: { name: "Maria" },
    };
    enqueueCalls.length = 0;
  });

  it("enqueues appointment_updated when the date changes", async () => {
    updatedAppointment.data = { ...updatedAppointment.data, date: "2026-12-26" };

    await updateAppointmentAction({
      id: "11111111-1111-1111-1111-111111111111",
      date: "2026-12-26",
    });

    expect(enqueueCalls).toEqual([
      expect.objectContaining({
        queueName: "whatsapp_notifications",
        notificationType: "appointment_updated",
        recipientType: "patient",
        recipientId: "patient-1",
      }),
    ]);
  });

  it("enqueues appointment_updated when the time changes", async () => {
    updatedAppointment.data = { ...updatedAppointment.data, time: "16:00" };

    await updateAppointmentAction({
      id: "11111111-1111-1111-1111-111111111111",
      time: "16:00",
    });

    expect(enqueueCalls).toHaveLength(1);
  });

  it("does not enqueue when updating unrelated fields (e.g. notes)", async () => {
    await updateAppointmentAction({
      id: "11111111-1111-1111-1111-111111111111",
      notes: "Paciente relatou enjoo",
    });

    expect(enqueueCalls).toHaveLength(0);
  });

  it("does not enqueue when date/time are submitted but unchanged", async () => {
    await updateAppointmentAction({
      id: "11111111-1111-1111-1111-111111111111",
      date: "2026-12-25",
      time: "14:00",
    });

    expect(enqueueCalls).toHaveLength(0);
  });
});
