import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayjs } from "@/lib/dayjs";

const { contractRow } = vi.hoisted(() => ({
  contractRow: {
    data: null as {
      is_signed: boolean;
      status: string;
      created_at: string;
      patient: { name: string; created_by: string } | null;
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

import { handleContractPendingSignature } from "./whatsapp-queue-handlers";

describe("handleContractPendingSignature", () => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === "contracts") return makeQueryBuilder(contractRow);
      if (table === "users")
        return makeQueryBuilder({ data: { name: "Dra. Ana" }, error: null });
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
    contractRow.data = { ...(contractRow.data as NonNullable<typeof contractRow.data>), status: "draft" };

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
