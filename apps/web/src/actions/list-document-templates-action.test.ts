import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templatesResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  templatesResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder
    then: (
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "document_templates") return makeQueryBuilder(templatesResult);
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

import { listDocumentTemplatesAction } from "./list-document-templates-action";

describe("listDocumentTemplatesAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templatesResult.data = [];
    templatesResult.error = null;
  });

  it("returns templates for the requested category", async () => {
    templatesResult.data = [
      {
        id: "t1",
        category: "exame",
        title: "Hemograma",
        scope: "personal",
        owner_id: "professional-1",
        content: { type: "doc", content: [] },
      },
    ];

    const res = await listDocumentTemplatesAction({ category: "exame" });

    expect(res?.data?.templates).toEqual(templatesResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("surfaces a server error from Supabase", async () => {
    templatesResult.error = { message: "connection error" };

    const res = await listDocumentTemplatesAction({ category: "exame" });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
