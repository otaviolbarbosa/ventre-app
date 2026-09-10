import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, updateResult, updateCalls } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: { data: { id: "professional-1" } as Record<string, unknown> | null, error: null },
  ueRow: { data: null as { enterprise_id: string } | null, error: null },
  updateResult: { data: null as unknown, error: null as { message: string } | null },
  updateCalls: [] as unknown[],
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn((payload: unknown) => {
      updateCalls.push(payload);
      return builder;
    }),
    select: vi.fn(() => builder),
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
      if (table === "contracts") return makeQueryBuilder(updateResult);
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
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deactivatePatientContractAction } from "./deactivate-patient-contract-action";

describe("deactivatePatientContractAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    updateResult.data = null;
    updateResult.error = null;
    updateCalls.length = 0;
  });

  it("marks the contract as revoked", async () => {
    const res = await deactivatePatientContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
    expect(updateCalls).toContainEqual({ status: "revoked" });
  });

  it("surfaces a server error when the update fails", async () => {
    updateResult.error = { message: "new row violates row-level security policy" };

    const res = await deactivatePatientContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
