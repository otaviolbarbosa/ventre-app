import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authUser,
  profileRow,
  ueRow,
  existingContract,
  patientRow,
  updateResult,
  contractUpdateCalls,
} = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
    error: null,
  },
  ueRow: { data: null as { enterprise_id: string } | null, error: null },
  existingContract: {
    data: { id: "contract-1", fully_signed_at: "2026-09-01T00:00:00.000Z" } as {
      id: string;
      fully_signed_at: string | null;
    } | null,
    error: null as unknown,
  },
  patientRow: {
    data: { created_by: "professional-1" } as { created_by: string } | null,
    error: null,
  },
  updateResult: { data: null as unknown, error: null as { message: string } | null },
  contractUpdateCalls: [] as unknown[],
}));

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn((payload: unknown) => {
      contractUpdateCalls.push(payload);
      return builder;
    }),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
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
      if (table === "team_members") return makeQueryBuilder({ data: null, error: null });
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

import { revokeContractAction } from "./revoke-contract-action";

describe("revokeContractAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    existingContract.data = { id: "contract-1", fully_signed_at: "2026-09-01T00:00:00.000Z" };
    patientRow.data = { created_by: "professional-1" };
    updateResult.data = null;
    updateResult.error = null;
    contractUpdateCalls.length = 0;
  });

  it("revokes a fully signed contract", async () => {
    const res = await revokeContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    expect(contractUpdateCalls).toEqual([
      expect.objectContaining({ status: "revoked", revoked_by: "professional-1" }),
    ]);
  });

  it("rejects revoking a contract that isn't fully signed", async () => {
    existingContract.data = { id: "contract-1", fully_signed_at: null };

    const res = await revokeContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBe(
      "Só é possível revogar contratos assinados por ambas as partes.",
    );
  });
});
