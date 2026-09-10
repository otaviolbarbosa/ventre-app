import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authUser,
  profileRow,
  ueRow,
  existingContract,
  signatureRows,
  insertResult,
  updateResult,
  patientRow,
  updateCalls,
  insertCalls,
  inCalls,
  renderCalls,
  signatureInsertCalls,
} = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: {
      id: "professional-1",
      name: "Dra. Ana",
      enterprise_id: null,
    } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: { data: null as { enterprise_id: string } | null, error: null as unknown },
  existingContract: {
    data: null as {
      id: string;
      is_signed: boolean;
      fully_signed_at: string | null;
      title: string;
      clauses_html: string;
      city: string | null;
      state: string | null;
    } | null,
    error: null as unknown,
  },
  signatureRows: { data: null as { id: string; signed_at: string }[] | null, error: null as unknown },
  insertResult: {
    data: { id: "new-contract-1" } as { id: string } | null,
    error: null as unknown,
  },
  updateResult: { data: null as unknown, error: null as unknown },
  patientRow: {
    data: { created_by: "professional-1" } as { created_by: string } | null,
    error: null as unknown,
  },
  updateCalls: [] as unknown[],
  insertCalls: [] as unknown[],
  inCalls: [] as unknown[][],
  renderCalls: [] as unknown[],
  signatureInsertCalls: [] as unknown[],
}));

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      insertCalls.push(payload);
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      updateCalls.push(payload);
      return builder;
    }),
    eq: vi.fn(() => builder),
    in: vi.fn((...args: unknown[]) => {
      inCalls.push(args);
      return builder;
    }),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    single: vi.fn(() => Promise.resolve(insertResult)),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }, table?: string) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      if (table === "contract_signatures") signatureInsertCalls.push(payload);
      return builder;
    }),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    // Some callers do `.select(...).limit(1)` and read `.data` as an array (e.g. the
    // "any signature exists" check), others do `.maybeSingle()` on the same table
    // expecting one row or null — unwrap arrays here so both shapes work off the
    // same `result`.
    maybeSingle: vi.fn(() =>
      Promise.resolve(
        Array.isArray(result.data)
          ? { data: result.data[0] ?? null, error: result.error }
          : result,
      ),
    ),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeContractsBuilder();
      if (table === "contract_signatures")
        return makeQueryBuilder(signatureRows, "contract_signatures");
      if (table === "patients") return makeQueryBuilder(patientRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "contracts") return makeQueryBuilder({ data: null, error: null });
      if (table === "contract_change_requests")
        return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/contract-parties", () => ({
  buildPatientContractParties: vi.fn(async () => ({
    patient: { name: "Maria", email: "maria@example.com", cpf: "000" },
    parties_details: { contratanteBlock: "x", contratadaBlock: "y", teamMembersBlock: null },
    contratadaName: "Dra. Ana",
  })),
}));
vi.mock("@/lib/contract-header-text", () => ({ hasUnfilledFields: vi.fn(() => false) }));
vi.mock("@/lib/contract-pdf", () => ({
  buildContractPdfFileName: vi.fn(() => "contrato.pdf"),
  renderContractPdfBuffer: vi.fn(async (args: unknown) => {
    renderCalls.push(args);
    return Buffer.from("pdf");
  }),
  sanitizeClausesHtml: vi.fn((html: string) => html),
  uploadContractPdf: vi.fn(async () => ({
    document: { id: "doc-1" },
    storagePath: "path/doc-1",
  })),
}));
vi.mock("@/lib/contract-signature-text", () => ({
  buildSignatureLocalityLine: vi.fn(() => "São Paulo, 09 de setembro de 2026"),
  formatAuditTimestamp: vi.fn(() => "09/09/2026, 10:00:00"),
}));
vi.mock("@/lib/contract-finalization", () => ({
  generateFinalizedContractPdf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/verification-code", () => ({ generateVerificationCode: vi.fn(() => "ABC123") }));
vi.mock("@/lib/notifications/queue", () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications/whatsapp-send", () => ({
  sendWhatsAppToUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", () => ({ isStaff: vi.fn(() => false) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { signPatientContractAction } from "./sign-patient-contract-action";

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";

describe("signPatientContractAction — draft finalization", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    insertCalls.length = 0;
    inCalls.length = 0;
    renderCalls.length = 0;
    signatureInsertCalls.length = 0;
    ueRow.data = null;
    existingContract.data = null;
    signatureRows.data = null;
    insertResult.data = { id: "new-contract-1" };
    updateResult.data = null;
    updateResult.error = null;
    patientRow.data = { created_by: "professional-1" };
  });

  it("finds and finalizes an existing draft, updating it in place to status active", async () => {
    existingContract.data = {
      id: "draft-1",
      is_signed: false,
      fully_signed_at: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: null,
      state: null,
    };

    const res = await signPatientContractAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: "São Paulo",
      state: "SP",
      consent: false,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    expect(inCalls[0]).toEqual(["status", ["draft", "active"]]);
    expect(updateCalls[0]).toMatchObject({ status: "active" });
  });

  it("creates a fresh active contract when there is no existing draft", async () => {
    const res = await signPatientContractAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: "São Paulo",
      state: "SP",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    expect(insertCalls[0]).toMatchObject({ status: "active" });
  });

  it("carries the patient's existing signature stamp into the professional's render when signing", async () => {
    existingContract.data = {
      id: "draft-1",
      is_signed: false,
      fully_signed_at: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: "São Paulo",
      state: "SP",
    };
    signatureRows.data = [{ id: "patient-sig-1", signed_at: "2026-09-01T00:00:00.000Z" }];

    const res = await signPatientContractAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: "São Paulo",
      state: "SP",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    const lastRender = renderCalls.at(-1) as {
      signature: { contratanteStamp?: unknown; contratadaStamp?: unknown };
    };
    expect(lastRender.signature.contratanteStamp).toMatchObject({
      signatureId: "patient-sig-1",
    });
    expect(lastRender.signature.contratadaStamp).toMatchObject({
      signedByName: "Dra. Ana",
    });
    expect(signatureInsertCalls[0]).toMatchObject({ signer_role: "professional" });
  });
});
