import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templatesResult, templatesEqSpy, templatesOrSpy, templatesOrderSpy } =
  vi.hoisted(() => ({
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
    templatesEqSpy: vi.fn(),
    templatesOrSpy: vi.fn(),
    templatesOrderSpy: vi.fn(),
  }));

// Plain builder for tables (`users`, `user_enterprises`) not under test here — no spies
// needed, since asserting the right filters were applied is only relevant for the
// `document_templates` query this test actually exercises.
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

// Dedicated builder for `document_templates`, with spies on `.eq()`/`.or()`/`.order()`
// separate from the shared builder above — `authActionClient`'s middleware also calls
// `.eq("id", user.id)` on `users` for the profile lookup, and mixing that call into a
// global spy's history would make asserting the real business-logic filters awkward.
function makeTemplatesQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      templatesEqSpy(...args);
      return builder;
    }),
    or: vi.fn((...args: unknown[]) => {
      templatesOrSpy(...args);
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      templatesOrderSpy(...args);
      return builder;
    }),
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
      if (table === "document_templates") return makeTemplatesQueryBuilder(templatesResult);
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
    templatesEqSpy.mockClear();
    templatesOrSpy.mockClear();
    templatesOrderSpy.mockClear();
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

  it("applies the category, owner/global scope, and ordering filters to the document_templates query", async () => {
    await listDocumentTemplatesAction({ category: "exame" });

    expect(templatesEqSpy).toHaveBeenCalledWith("category", "exame");
    expect(templatesOrSpy).toHaveBeenCalledWith(
      expect.stringContaining("owner_id.eq.professional-1"),
    );
    expect(templatesOrderSpy).toHaveBeenCalledWith("scope", { ascending: false });
  });

  it("surfaces a server error from Supabase", async () => {
    templatesResult.error = { message: "connection error" };

    const res = await listDocumentTemplatesAction({ category: "exame" });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
