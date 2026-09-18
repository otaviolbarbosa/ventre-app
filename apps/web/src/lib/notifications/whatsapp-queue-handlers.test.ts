import { dayjs } from "@/lib/dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { contractRow, appointmentRow, installmentRow } = vi.hoisted(() => ({
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
  installmentRow: {
    data: null as {
      due_date: string;
      amount: number;
      status: string;
      installment_number: number;
      billing: {
        description: string;
        patient: { name: string; created_by: string } | null;
      } | null;
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
  handleInstallmentPaymentReminder,
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-20T12:00:00.000Z"));
    appointmentRow.data = {
      date: "2026-12-25",
      time: "14:00:00",
      status: "agendada",
      type: "consulta",
      patient: { name: "Maria" },
      professional: { name: "Dra. Ana" },
    };
    appointmentRow.error = null;
  });

  afterEach(() => {
    vi.useRealTimers();
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
        date: "25/12",
        time: "14:00",
        appointmentId: "appointment-1",
      },
    });
  });

  it("uses 'hoje'/'amanhã' for the date when the appointment is very soon", async () => {
    appointmentRow.data = {
      ...(appointmentRow.data as NonNullable<typeof appointmentRow.data>),
      date: "2026-12-20",
    };
    const today = await handler(supabaseAdmin, {
      referenceId: "appointment-1",
      recipientType: "patient",
      recipientId: "patient-1",
    } as Parameters<typeof handler>[1]);
    expect(today.action === "send" && today.templateParams.date).toBe("hoje");

    appointmentRow.data = {
      ...(appointmentRow.data as NonNullable<typeof appointmentRow.data>),
      date: "2026-12-21",
    };
    const tomorrow = await handler(supabaseAdmin, {
      referenceId: "appointment-1",
      recipientType: "patient",
      recipientId: "patient-1",
    } as Parameters<typeof handler>[1]);
    expect(tomorrow.action === "send" && tomorrow.templateParams.date).toBe("amanhã");
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

describe("handleInstallmentPaymentReminder", () => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === "installments") return makeQueryBuilder(installmentRow);
      if (table === "users")
        return makeQueryBuilder({ data: { name: "Bruna de Mello" }, error: null });
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof handleInstallmentPaymentReminder>[0];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
    installmentRow.data = {
      due_date: "2026-01-13",
      amount: 99.99,
      status: "pendente",
      installment_number: 3,
      billing: {
        description: "Pré-natal Emocional",
        patient: { name: "Joana", created_by: "professional-1" },
      },
    };
    installmentRow.error = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses 'em N dias' when the due date is a few days away", async () => {
    const result = await handleInstallmentPaymentReminder(supabaseAdmin, {
      referenceId: "installment-1",
      recipientType: "patient",
      recipientId: "patient-1",
    } as Parameters<typeof handleInstallmentPaymentReminder>[1]);

    expect(result).toEqual({
      action: "send",
      recipient: { recipientType: "patient", recipientId: "patient-1" },
      templateParams: {
        patientName: "Joana",
        installmentNumber: 3,
        amount: "99.99",
        billingName: "Pré-natal Emocional",
        dueDate: "em 3 dias",
        professionalName: "Bruna de Mello",
      },
    });
  });

  it("uses 'hoje' when the installment is due today", async () => {
    installmentRow.data = {
      ...(installmentRow.data as NonNullable<typeof installmentRow.data>),
      due_date: "2026-01-10",
    };

    const result = await handleInstallmentPaymentReminder(supabaseAdmin, {
      referenceId: "installment-1",
      recipientType: "patient",
      recipientId: "patient-1",
    } as Parameters<typeof handleInstallmentPaymentReminder>[1]);

    expect(result.action).toBe("send");
    expect(result.action === "send" && result.templateParams.dueDate).toBe("hoje");
  });

  it("skips when the installment is no longer pending (e.g. already paid)", async () => {
    installmentRow.data = {
      ...(installmentRow.data as NonNullable<typeof installmentRow.data>),
      status: "pago",
    };

    const result = await handleInstallmentPaymentReminder(supabaseAdmin, {
      referenceId: "installment-1",
    } as Parameters<typeof handleInstallmentPaymentReminder>[1]);

    expect(result.action).toBe("skip");
  });
});
