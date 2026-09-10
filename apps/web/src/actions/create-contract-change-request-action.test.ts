import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, patientRow, existingContract, insertResult } = vi.hoisted(() => ({
  authUser: { id: "patient-user-1" },
  patientRow: {
    data: {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      created_by: "professional-1",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  existingContract: {
    data: { id: "contract-1" } as { id: string } | null,
    error: null as unknown,
  },
  insertResult: { data: null as unknown, error: null as { message: string; code?: string } | null },
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
      if (table === "contract_change_requests") return makeQueryBuilder(insertResult);
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
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications/queue", () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications/whatsapp-send", () => ({
  sendWhatsAppToUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createContractChangeRequestAction } from "./create-contract-change-request-action";

describe("createContractChangeRequestAction", () => {
  beforeEach(() => {
    patientRow.data = {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      created_by: "professional-1",
    };
    existingContract.data = { id: "contract-1" };
    insertResult.data = null;
    insertResult.error = null;
    contractQueryCalls.length = 0;
  });

  it("accepts a change request against a draft contract", async () => {
    const res = await createContractChangeRequestAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      messageHtml: "<p>Poderiam revisar a cláusula 3?</p>",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);

    const inCall = contractQueryCalls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", ["draft", "active"]]);
  });

  it("rejects when no draft or active contract exists", async () => {
    existingContract.data = null;

    const res = await createContractChangeRequestAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      messageHtml: "<p>Texto</p>",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
