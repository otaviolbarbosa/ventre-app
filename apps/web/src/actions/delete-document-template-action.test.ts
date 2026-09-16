import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templateResult, templatesEqSpy } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  templateResult: {
    data: null as unknown,
    error: null as { message: string } | null,
  },
  templatesEqSpy: vi.fn(),
}));

// Plain builder for tables (`users`, `user_enterprises`) not under test here — no spies
// needed.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    delete: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

// Dedicated builder for `document_templates`, with a spy on `.eq()` separate from the
// shared builder above — `authActionClient`'s middleware also calls `.eq("id", user.id)`
// on `users` for the profile lookup, and mixing that call into a global spy's history
// would make asserting the real ownership/scope filters awkward.
function makeTemplatesQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    delete: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      templatesEqSpy(...args);
      return builder;
    }),
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
      if (table === "document_templates") return makeTemplatesQueryBuilder(templateResult);
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

import { deleteDocumentTemplateAction } from "./delete-document-template-action";

describe("deleteDocumentTemplateAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templateResult.data = null;
    templateResult.error = null;
    templatesEqSpy.mockClear();
  });

  it("deletes a template the caller owns", async () => {
    templateResult.data = {
      id: "t1",
      category: "exame",
      title: "Hemograma",
      scope: "personal",
      owner_id: "professional-1",
      content: { type: "doc", content: [] },
    };

    const res = await deleteDocumentTemplateAction({
      templateId: "11111111-1111-1111-1111-111111111111",
    });

    expect(res?.data?.template).toEqual(templateResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("filters the delete by id, owner_id, and scope='personal'", async () => {
    templateResult.data = {
      id: "11111111-1111-1111-1111-111111111111",
      category: "exame",
      title: "Hemograma",
      scope: "personal",
      owner_id: "professional-1",
      content: { type: "doc", content: [] },
    };

    await deleteDocumentTemplateAction({
      templateId: "11111111-1111-1111-1111-111111111111",
    });

    expect(templatesEqSpy).toHaveBeenCalledWith("id", "11111111-1111-1111-1111-111111111111");
    expect(templatesEqSpy).toHaveBeenCalledWith("owner_id", "professional-1");
    expect(templatesEqSpy).toHaveBeenCalledWith("scope", "personal");
  });

  it("rejects deleting a template it doesn't own (wrong owner or scope='global')", async () => {
    templateResult.error = { message: "JSON object requested, multiple (or no) rows returned" };

    const res = await deleteDocumentTemplateAction({
      templateId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
