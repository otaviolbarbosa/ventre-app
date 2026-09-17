import { dayjs } from "@/lib/dayjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { contractRow, appointmentRow } = vi.hoisted(() => ({
  contractRow: {
    data: null as {
      is_signed: boolean;
      status: string;
      created_at: string;
      patient: { name: string; created_by: string } | null;
    } | null,
    error: null as { message: string } | null,
  },
  appointmentRow: {
    data: null as {
      date: string;
      time: string;
      status: string;
      type: string;
      patient: { name: string } | null;
      professional: { name: string } | null;
    } | null,
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

import {
  handleAppointmentRescheduling,
  handleAppointmentScheduled,
  handleContractPendingSignature,
} from "./whatsapp-queue-handlers";

describe("handleContractPendingSignature", () => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === "contracts") return makeQueryBuilder(contractRow);
      if (table === "users") return makeQueryBuilder({ data: { name: "Dra. Ana" }, error: null });
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof handleContractPendingSignature>[0];

  const oldEnoughCreatedAt = dayjs().subtract(4, "day").toISOString();

  beforeEach(() => {
    contractRow.data = {
      is_signed: false,
      status: "active",
      created_at: oldEnoughCreatedAt,
      patient: { name: "Maria", created_by: "professional-1" },
    };
    contractRow.error = null;
  });

  it("skips a draft contract even if old and unsigned", async () => {
    contractRow.data = {
      ...(contractRow.data as NonNullable<typeof contractRow.data>),
      status: "draft",
    };

    const result = await handleContractPendingSignature(supabaseAdmin, {
      referenceId: "contract-1",
    } as Parameters<typeof handleContractPendingSignature>[1]);

    expect(result.action).toBe("skip");
  });

  it("does not skip an old, unsigned, active contract solely due to status", async () => {
    const result = await handleContractPendingSignature(supabaseAdmin, {
      referenceId: "contract-1",
    } as Parameters<typeof handleContractPendingSignature>[1]);

    expect(result.action).not.toBe("skip");
  });
});

describe.each([
  ["handleAppointmentScheduled", handleAppointmentScheduled],
  ["handleAppointmentRescheduling", handleAppointmentRescheduling],
] as const)("%s", (_name, handler) => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === "appointments") return makeQueryBuilder(appointmentRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof handler>[0];

  beforeEach(() => {
    appointmentRow.data = {
      date: "2026-12-25",
      time: "14:00",
      status: "agendada",
      type: "consulta",
      patient: { name: "Maria" },
      professional: { name: "Dra. Ana" },
    };
    appointmentRow.error = null;
  });

  it("sends with patient name, appointment type, professional name, date, time and appointmentId as button parameter", async () => {
    const result = await handler(supabaseAdmin, {
      referenceId: "appointment-1",
      recipientType: "patient",
      recipientId: "patient-1",
    } as Parameters<typeof handler>[1]);

    expect(result).toEqual({
      action: "send",
      recipient: { recipientType: "patient", recipientId: "patient-1" },
      templateParams: {
        patientName: "Maria",
        appointmentType: "Consulta",
        professionalName: "Dra. Ana",
        date: "2026-12-25",
        time: "14:00",
        appointmentId: "appointment-1",
      },
    });
  });

  it("skips when the appointment is no longer scheduled (e.g. cancelled in the meantime)", async () => {
    appointmentRow.data = {
      ...(appointmentRow.data as NonNullable<typeof appointmentRow.data>),
      status: "cancelada",
    };

    const result = await handler(supabaseAdmin, {
      referenceId: "appointment-1",
    } as Parameters<typeof handler>[1]);

    expect(result.action).toBe("skip");
  });

  it("skips when the appointment no longer exists", async () => {
    appointmentRow.data = null;

    const result = await handler(supabaseAdmin, {
      referenceId: "appointment-1",
    } as Parameters<typeof handler>[1]);

    expect(result.action).toBe("skip");
  });
});
