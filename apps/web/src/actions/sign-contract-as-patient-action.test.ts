import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, patientRow, existingContract, signatureRows } = vi.hoisted(() => ({
  authUser: { id: "patient-user-1" },
  patientRow: {
    data: {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      email: "maria@example.com",
      cpf: "000",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  existingContract: {
    data: {
      id: "contract-1",
      is_signed: true,
      verification_code: "ABC123",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      city: null,
      state: null,
      enterprise_id: null,
      signed_at: "2026-09-01T00:00:00.000Z",
      signed_by: "professional-1",
      content_hash: "hash",
      original_document_id: "doc-1",
      status: "active",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  signatureRows: { data: null as { id: string } | null, error: null as unknown },
}));

const contractQueryCalls: { method: string; args: unknown[] }[] = [];
const signatureInsertCalls: unknown[] = [];

function makeQueryBuilder(result: { data: unknown; error: unknown }, table?: string) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      if (table === "contracts") contractQueryCalls.push({ method: "insert", args: [payload] });
      if (table === "contract_signatures") signatureInsertCalls.push(payload);
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      if (table === "contracts") contractQueryCalls.push({ method: "update", args: [payload] });
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      if (table === "contracts") contractQueryCalls.push({ method: "eq", args });
      return builder;
    }),
    in: vi.fn((...args: unknown[]) => {
      if (table === "contracts") contractQueryCalls.push({ method: "in", args });
      return builder;
    }),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users")
        return makeQueryBuilder({ data: { user_type: "patient" }, error: null });
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "contracts") return makeQueryBuilder(existingContract, "contracts");
      if (table === "contract_signatures")
        return makeQueryBuilder(signatureRows, "contract_signatures");
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/contract-header-text", () => ({ hasUnfilledFields: vi.fn(() => false) }));
vi.mock("@/lib/contract-finalization", () => ({
  generateFinalizedContractPdf: vi.fn().mockResolvedValue(undefined),
}));
const { renderCalls, uploadCalls } = vi.hoisted(() => ({
  renderCalls: [] as unknown[],
  uploadCalls: [] as unknown[],
}));
vi.mock("@/lib/contract-pdf", () => ({
  buildContractPdfFileName: vi.fn(() => "contrato.pdf"),
  renderContractPdfBuffer: vi.fn(async (args: unknown) => {
    renderCalls.push(args);
    return Buffer.from("pdf");
  }),
  sanitizeClausesHtml: vi.fn((html: string) => html),
  uploadContractPdf: vi.fn(async (args: unknown) => {
    uploadCalls.push(args);
    return { document: { id: "new-original-doc" }, storagePath: "path/new-original-doc" };
  }),
}));
vi.mock("@/lib/contract-signature-text", () => ({
  buildSignatureLocalityLine: vi.fn(() => "São Paulo, 09 de setembro de 2026"),
  formatAuditTimestamp: vi.fn(() => "09/09/2026, 10:00:00"),
}));
vi.mock("@/services/base-contract", () => ({
  getContratadaNameForContract: vi.fn(async () => "Dra. Ana"),
}));
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { signContractAsPatientAction } from "./sign-contract-as-patient-action";

describe("signContractAsPatientAction", () => {
  beforeEach(() => {
    patientRow.data = {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      email: "maria@example.com",
      cpf: "000",
    };
    existingContract.data = {
      id: "contract-1",
      is_signed: true,
      verification_code: "ABC123",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      city: null,
      state: null,
      enterprise_id: null,
      signed_at: "2026-09-01T00:00:00.000Z",
      signed_by: "professional-1",
      content_hash: "hash",
      original_document_id: "doc-1",
      status: "active",
    };
    signatureRows.data = null;
    contractQueryCalls.length = 0;
    signatureInsertCalls.length = 0;
    renderCalls.length = 0;
    uploadCalls.length = 0;
  });

  it("signs an active contract", async () => {
    const res = await signContractAsPatientAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);

    const inCall = contractQueryCalls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", ["draft", "active"]]);
  });

  it("rejects signing a draft contract", async () => {
    existingContract.data = {
      ...(existingContract.data as Record<string, unknown>),
      status: "draft",
    };

    const res = await signContractAsPatientAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      consent: true,
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });

  it("regenerates the original PDF with the patient's stamp when the professional hasn't signed yet", async () => {
    existingContract.data = {
      ...(existingContract.data as Record<string, unknown>),
      is_signed: false,
      signed_by: null,
      content_hash: null,
      verification_code: null,
    };

    const res = await signContractAsPatientAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);

    expect(signatureInsertCalls[0]).toMatchObject({ signer_role: "patient" });
    expect(renderCalls).toHaveLength(1);
    const render = renderCalls[0] as { signature: { contratanteStamp?: { signatureId: string } } };
    expect(render.signature.contratanteStamp?.signatureId).toBe(
      (signatureInsertCalls[0] as { id: string }).id,
    );
    expect(uploadCalls).toHaveLength(1);
    const updateCall = contractQueryCalls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toMatchObject({ original_document_id: "new-original-doc" });
  });

  it("does not regenerate the original PDF once the professional has already signed", async () => {
    const res = await signContractAsPatientAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(renderCalls).toHaveLength(0);
    expect(uploadCalls).toHaveLength(0);
  });
});
