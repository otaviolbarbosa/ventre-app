import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, evolutionsResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  evolutionsResult: {
    data: null as unknown,
    error: null as { message: string } | null,
  },
}));

function makeSingleQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function makeListQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeSingleQueryBuilder(profileRow);
      if (table === "patient_evolutions") return makeListQueryBuilder(evolutionsResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeSingleQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { getPatientEvolutionsAction } from "./get-patient-evolutions-action";

describe("getPatientEvolutionsAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    evolutionsResult.data = null;
    evolutionsResult.error = null;
  });

  it("derives hasUpdatedContent from edited_content and never returns the history array", async () => {
    evolutionsResult.data = [
      {
        id: "evo-edited",
        content: "Conteúdo corrigido",
        created_at: "2026-09-01T10:00:00Z",
        updated_at: "2026-09-03T15:30:00Z",
        is_public: true,
        patient_id: "patient-1",
        professional_id: "professional-1",
        edited_content: [
          { content: "Conteúdo original", is_public: true, updated_at: "2026-09-01T10:00:00Z" },
        ],
        professional: { id: "professional-1", name: "Dra. Ana", avatar_url: null },
      },
      {
        id: "evo-untouched",
        content: "Paciente estável",
        created_at: "2026-09-02T10:00:00Z",
        updated_at: "2026-09-02T10:00:00Z",
        is_public: true,
        patient_id: "patient-1",
        professional_id: "professional-1",
        edited_content: [],
        professional: { id: "professional-1", name: "Dra. Ana", avatar_url: null },
      },
    ];

    const res = await getPatientEvolutionsAction({
      patientId: "11111111-1111-1111-1111-111111111111",
    });

    expect(res?.data?.evolutions).toEqual([
      {
        id: "evo-edited",
        content: "Conteúdo corrigido",
        created_at: "2026-09-01T10:00:00Z",
        updated_at: "2026-09-03T15:30:00Z",
        is_public: true,
        patient_id: "patient-1",
        professional_id: "professional-1",
        hasUpdatedContent: true,
        professional: { id: "professional-1", name: "Dra. Ana", avatar_url: null },
      },
      {
        id: "evo-untouched",
        content: "Paciente estável",
        created_at: "2026-09-02T10:00:00Z",
        updated_at: "2026-09-02T10:00:00Z",
        is_public: true,
        patient_id: "patient-1",
        professional_id: "professional-1",
        hasUpdatedContent: false,
        professional: { id: "professional-1", name: "Dra. Ana", avatar_url: null },
      },
    ]);
    expect(res?.data?.evolutions.every((e) => !("edited_content" in e))).toBe(true);
  });

  it("surfaces a server error when the query fails", async () => {
    evolutionsResult.error = { message: "connection error" };

    const res = await getPatientEvolutionsAction({
      patientId: "11111111-1111-1111-1111-111111111111",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
