import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templateResult, insertSpy } = vi.hoisted(() => ({
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
  insertSpy: vi.fn(),
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    insert: vi.fn((payload: unknown) => {
      insertSpy(payload);
      return builder;
    }),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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
      if (table === "document_templates") return makeQueryBuilder(templateResult);
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

import { createDocumentTemplateAction } from "./create-document-template-action";

describe("createDocumentTemplateAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templateResult.data = null;
    templateResult.error = null;
    insertSpy.mockClear();
  });

  it("always inserts with scope='personal' and owner_id=user.id", async () => {
    templateResult.data = {
      id: "t1",
      category: "exame",
      title: "Hemograma",
      scope: "personal",
      owner_id: "professional-1",
      content: { type: "doc", content: [] },
    };

    const res = await createDocumentTemplateAction({
      category: "exame",
      title: "Hemograma",
      content: { type: "doc", content: [] },
    });

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "personal", owner_id: "professional-1" }),
    );
    expect(res?.data?.template).toEqual(templateResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("surfaces a server error from Supabase", async () => {
    templateResult.error = { message: "insert failed" };

    const res = await createDocumentTemplateAction({
      category: "exame",
      title: "Hemograma",
      content: { type: "doc", content: [] },
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
