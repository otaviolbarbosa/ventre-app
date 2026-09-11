import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, existingRequest, patientRow, teamRow, updateResult } =
  vi.hoisted(() => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
      error: null,
    },
    ueRow: { data: null as { enterprise_id: string } | null, error: null },
    existingRequest: {
      data: { id: "request-1", status: "pending", patient_id: "patient-1" } as {
        id: string;
        status: string;
        patient_id: string;
      } | null,
      error: null as unknown,
    },
    patientRow: {
      data: { created_by: "professional-1" } as { created_by: string } | null,
      error: null,
    },
    teamRow: { data: null as { id: string } | null, error: null },
    updateResult: { data: null as unknown, error: null as { message: string } | null },
  }));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contract_change_requests") return makeQueryBuilder(existingRequest);
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "team_members") return makeQueryBuilder(teamRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "contract_change_requests") return makeQueryBuilder(updateResult);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", () => ({ isStaff: vi.fn(() => false) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { isStaff } from "@/lib/access-control";
import { resolveContractChangeRequestAction } from "./resolve-contract-change-request-action";

describe("resolveContractChangeRequestAction", () => {
  beforeEach(() => {
    vi.mocked(isStaff).mockReturnValue(false);
    ueRow.data = null;
    existingRequest.data = { id: "request-1", status: "pending", patient_id: "patient-1" };
    patientRow.data = { created_by: "professional-1" };
    teamRow.data = null;
    updateResult.data = null;
    updateResult.error = null;
  });

  const input = {
    requestId: "11111111-1111-1111-1111-111111111111",
    patientId: "22222222-2222-2222-2222-222222222222",
  };

  it("allows the autonomous professional who created the patient to resolve", async () => {
    const res = await resolveContractChangeRequestAction(input);

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("rejects an autonomous professional who did not create the patient", async () => {
    patientRow.data = { created_by: "someone-else" };

    const res = await resolveContractChangeRequestAction(input);

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });

  it("allows enterprise managers/secretaries to resolve", async () => {
    ueRow.data = { enterprise_id: "enterprise-1" };
    vi.mocked(isStaff).mockReturnValue(true);

    const res = await resolveContractChangeRequestAction(input);

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("allows a team member professional (contract author) to resolve", async () => {
    ueRow.data = { enterprise_id: "enterprise-1" };
    vi.mocked(isStaff).mockReturnValue(false);
    teamRow.data = { id: "team-member-1" };

    const res = await resolveContractChangeRequestAction(input);

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("rejects an enterprise professional who is neither staff nor a team member", async () => {
    ueRow.data = { enterprise_id: "enterprise-1" };
    vi.mocked(isStaff).mockReturnValue(false);
    teamRow.data = null;

    const res = await resolveContractChangeRequestAction(input);

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });

  it("rejects resolving an already-resolved request", async () => {
    existingRequest.data = { id: "request-1", status: "resolved", patient_id: "patient-1" };

    const res = await resolveContractChangeRequestAction(input);

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
