import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { authUser, profileRow, ueRow, existingContract, insertResult, updateResult } = vi.hoisted(
  () => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", name: "Dra. Ana", enterprise_id: null } as Record<
        string,
        unknown
      > | null,
      error: null as { message: string } | null,
    },
    ueRow: {
      data: null as { enterprise_id: string } | null,
      error: null as { message: string } | null,
    },
    existingContract: {
      data: null as { id: string; status: string } | null,
      error: null as { message: string } | null,
    },
    insertResult: {
      data: { id: "new-contract-1" } as { id: string } | null,
      error: null as { message: string; code?: string } | null,
    },
    updateResult: {
      data: null as unknown,
      error: null as { message: string } | null,
    },
  }),
);

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    single: vi.fn(() => Promise.resolve(insertResult)),
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
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
      if (table === "contracts") return makeContractsBuilder();
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

import { saveContractDraftAction } from "./save-contract-draft-action";

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";

describe("saveContractDraftAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    existingContract.data = null;
    existingContract.error = null;
    insertResult.data = { id: "new-contract-1" };
    insertResult.error = null;
    updateResult.data = null;
    updateResult.error = null;
  });

  it("creates a new draft when the patient has no existing contract", async () => {
    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula 1</p>",
      city: "",
      state: "",
    });

    expect(res?.data?.contractId).toBe("new-contract-1");
    expect(res?.serverError).toBeUndefined();
  });

  it("updates an existing draft in place", async () => {
    existingContract.data = { id: "draft-1", status: "draft" };

    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "Título atualizado",
      clauses_html: "<p>Cláusula editada</p>",
      city: "",
      state: "",
    });

    expect(res?.data?.contractId).toBe("draft-1");
    expect(res?.serverError).toBeUndefined();
  });

  it("rejects saving a draft over an already-generated contract", async () => {
    existingContract.data = { id: "active-1", status: "active" };

    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "Título",
      clauses_html: "<p>Cláusula</p>",
      city: "",
      state: "",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("já foi gerado");
  });

  it("surfaces a friendly error on a unique-constraint race", async () => {
    insertResult.data = null;
    insertResult.error = { message: "duplicate key value violates unique constraint", code: "23505" };

    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "Título",
      clauses_html: "<p>Cláusula</p>",
      city: "",
      state: "",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("Já existe um contrato");
  });
});
