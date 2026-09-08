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
    insert: vi.fn(() => builder),
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

import { createEvolutionAction } from "./create-evolution-action";

describe("createEvolutionAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    evolutionResult.data = null;
    evolutionResult.error = null;
  });

  it("creates an evolution and returns it", async () => {
    evolutionResult.data = {
      id: "evolution-1",
      patient_id: "patient-1",
      content: "Paciente estável",
      is_public: true,
      professional: { id: "professional-1", name: "Dra. Ana" },
    };

    const res = await createEvolutionAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      data: { content: "Paciente estável", is_public: true },
    });

    expect(res?.data?.evolution).toEqual(evolutionResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("surfaces a server error when the insert fails (e.g. RLS rejection)", async () => {
    evolutionResult.error = { message: "new row violates row-level security policy" };

    const res = await createEvolutionAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      data: { content: "Paciente estável", is_public: true },
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
