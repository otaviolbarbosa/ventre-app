import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, patientRow, createdAppointment, enqueueCalls } = vi.hoisted(
  () => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
      error: null,
    },
    ueRow: { data: null as { enterprise_id: string } | null, error: null },
    patientRow: { data: { name: "Maria" } as { name: string } | null, error: null },
    createdAppointment: {
      id: "appointment-1",
      patient_id: "11111111-1111-1111-1111-111111111111",
      date: "2026-12-25",
      time: "14:00:00",
      type: "consulta" as const,
    },
    enqueueCalls: [] as unknown[],
  }),
);

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
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
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "pregnancies") return makeQueryBuilder({ data: null, error: null });
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
vi.mock("@/services/appointment", () => ({
  createAppointment: vi.fn(async () => createdAppointment),
}));
vi.mock("@/services/google-calendar", () => ({
  syncCreateToGoogleCalendar: vi.fn().mockResolvedValue(undefined),
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

import { addAppointmentAction } from "./add-appointment-action";

describe("addAppointmentAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    patientRow.data = { name: "Maria" };
    createdAppointment.patient_id = "11111111-1111-1111-1111-111111111111";
    enqueueCalls.length = 0;
  });

  it("enqueues appointment_scheduled for the patient when an appointment is created", async () => {
    await addAppointmentAction({
      patient_id: "11111111-1111-1111-1111-111111111111",
      date: "2026-12-25",
      time: "14:00",
      type: "consulta",
    });

    expect(enqueueCalls).toEqual([
      expect.objectContaining({
        queueName: "whatsapp_notifications",
        notificationType: "appointment_scheduled",
        referenceType: "appointment",
        referenceId: "appointment-1",
        recipientType: "patient",
        recipientId: "11111111-1111-1111-1111-111111111111",
      }),
    ]);
  });

  it("does not enqueue when the appointment has no patient (external patient)", async () => {
    createdAppointment.patient_id = null as unknown as string;

    await addAppointmentAction({
      is_external: true,
      external_patient_name: "Paciente Externa",
      date: "2026-12-25",
      time: "14:00",
      type: "consulta",
    });

    expect(enqueueCalls).toHaveLength(0);
  });
});
