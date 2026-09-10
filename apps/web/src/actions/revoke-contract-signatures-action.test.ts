import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authUser,
  profileRow,
  ueRow,
  existingContract,
  patientRow,
  insertResult,
  updateResult,
  contractUpdateCalls,
  contractInsertCalls,
} = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
    error: null,
  },
  ueRow: { data: null as { enterprise_id: string } | null, error: null },
  existingContract: {
    data: {
      id: "contract-1",
      is_signed: true,
      fully_signed_at: null,
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      city: null,
      state: null,
      pregnancy_id: null,
      enterprise_id: null,
      user_id: "professional-1",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  patientRow: {
    data: { created_by: "professional-1" } as { created_by: string } | null,
    error: null,
  },
  insertResult: { data: { id: "new-contract-1" } as { id: string } | null, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  contractUpdateCalls: [] as unknown[],
  contractInsertCalls: [] as unknown[],
}));

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      contractInsertCalls.push(payload);
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      contractUpdateCalls.push(payload);
      return builder;
    }),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    single: vi.fn(() => Promise.resolve(insertResult)),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeContractsBuilder();
      if (table === "patients") return makeQueryBuilder(patientRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "contract_change_requests")
        return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", () => ({ isStaff: vi.fn(() => false) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revokeContractSignaturesAction } from "./revoke-contract-signatures-action";

describe("revokeContractSignaturesAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    existingContract.data = {
      id: "contract-1",
      is_signed: true,
      fully_signed_at: null,
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      city: null,
      state: null,
      pregnancy_id: null,
      enterprise_id: null,
      user_id: "professional-1",
    };
    patientRow.data = { created_by: "professional-1" };
    insertResult.data = { id: "new-contract-1" };
    updateResult.data = null;
    updateResult.error = null;
    contractUpdateCalls.length = 0;
    contractInsertCalls.length = 0;
  });

  it("revokes the signed contract and recreates it as active", async () => {
    const res = await revokeContractSignaturesAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.contractId).toBe("new-contract-1");
    expect(contractUpdateCalls).toEqual([
      expect.objectContaining({ status: "revoked", revoked_by: "professional-1" }),
    ]);
    expect(contractInsertCalls).toEqual([expect.objectContaining({ status: "active" })]);
  });
});
