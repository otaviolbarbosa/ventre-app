import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, contractRow } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  contractRow: {
    data: null as { id: string; fully_signed_at: string | null } | null,
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
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
      if (table === "contracts") return makeQueryBuilder(contractRow);
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

vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn() }));

import { revokeContractAction } from "./revoke-contract-action";

describe("revokeContractAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    contractRow.data = null;
    contractRow.error = null;
  });

  it("surfaces the real business error message when the contract isn't fully signed", async () => {
    contractRow.data = { id: "contract-1", fully_signed_at: null };

    const res = await revokeContractAction({
      contractId: "22222222-2222-2222-2222-222222222222",
      patientId: "33333333-3333-3333-3333-333333333333",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBe(
      "Só é possível revogar contratos assinados por ambas as partes.",
    );
  });
});
