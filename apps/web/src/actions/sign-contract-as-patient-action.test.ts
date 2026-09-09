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

function makeQueryBuilder(result: { data: unknown; error: unknown }, table?: string) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
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
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder({ data: { user_type: "patient" }, error: null });
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "contracts") return makeQueryBuilder(existingContract, "contracts");
      if (table === "contract_signatures") return makeQueryBuilder(signatureRows);
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
vi.mock("@/lib/contract-finalization", () => ({ generateFinalizedContractPdf: vi.fn(async () => {}) }));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
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
});
