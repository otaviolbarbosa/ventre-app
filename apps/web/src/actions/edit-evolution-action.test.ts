import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, evolutionResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  evolutionResult: {
    data: null as unknown,
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(() => builder),
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
      if (table === "patient_evolutions") return makeQueryBuilder(evolutionResult);
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

vi.mock("@/lib/activity-log", () => ({ insertActivityLog: vi.fn() }));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn() }));

import { editEvolutionAction } from "./edit-evolution-action";

describe("editEvolutionAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    evolutionResult.data = null;
    evolutionResult.error = null;
  });

  it("updates an evolution the professional owns and returns it", async () => {
    evolutionResult.data = {
      id: "evolution-1",
      patient_id: "patient-1",
      content: "Conteúdo corrigido",
      is_public: false,
      professional: { id: "professional-1", name: "Dra. Ana" },
    };

    const res = await editEvolutionAction({
      evolutionId: "22222222-2222-2222-2222-222222222222",
      data: { content: "Conteúdo corrigido", is_public: false },
    });

    expect(res?.data?.evolution).toEqual(evolutionResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("surfaces a server error when RLS blocks the update (not the owning professional)", async () => {
    // With .single() against a row RLS's USING clause filters out, PostgREST
    // returns 0 rows and an error rather than null data with no error.
    evolutionResult.error = { message: "JSON object requested, multiple (or no) rows returned" };

    const res = await editEvolutionAction({
      evolutionId: "22222222-2222-2222-2222-222222222222",
      data: { content: "Tentando editar registro alheio", is_public: true },
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
