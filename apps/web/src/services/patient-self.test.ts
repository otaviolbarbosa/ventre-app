import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authUser,
  patientRow,
  contractsResult,
  contractByIdResult,
  signaturesListResult,
  signatureByIdResult,
  changeRequestsResult,
} = vi.hoisted(() => ({
  authUser: { id: "patient-user-1" } as { id: string } | null,
  patientRow: { data: { id: "patient-1" } as { id: string } | null, error: null as unknown },
  contractsResult: { data: [] as unknown[], error: null as unknown },
  contractByIdResult: { data: null as Record<string, unknown> | null, error: null as unknown },
  signaturesListResult: { data: [] as { contract_id: string }[], error: null as unknown },
  signatureByIdResult: { data: null as { id: string } | null, error: null as unknown },
  changeRequestsResult: { data: [] as unknown[], error: null as unknown },
}));

function makeQueryBuilder(listResult: { data: unknown; error: unknown }, singleResult?: {
  data: unknown;
  error: unknown;
}) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(singleResult ?? listResult)),
    // biome-ignore lint/suspicious/noThenProperty: mock must be thenable to emulate Supabase's awaitable query builder
    then: (resolve: (v: unknown) => unknown) => resolve(listResult),
  };
  return builder;
}

vi.mock("@/lib/server-auth", () => ({
  getServerAuth: vi.fn(async () => ({
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "patients") return makeQueryBuilder(patientRow, patientRow);
        if (table === "contracts")
          return makeQueryBuilder(contractsResult, contractByIdResult);
        if (table === "contract_signatures")
          return makeQueryBuilder(signaturesListResult, signatureByIdResult);
        if (table === "contract_change_requests") return makeQueryBuilder(changeRequestsResult);
        throw new Error(`unexpected table: ${table}`);
      }),
    },
    user: authUser,
  })),
}));

import { getMyContractById, getMyContracts } from "./patient-self";

describe("getMyContracts", () => {
  beforeEach(() => {
    patientRow.data = { id: "patient-1" };
    contractsResult.data = [];
    signaturesListResult.data = [];
  });

  it("returns draft and active contracts for the patient", async () => {
    contractsResult.data = [
      { id: "contract-1", status: "draft", title: "Rascunho" },
      { id: "contract-2", status: "active", title: "Ativo" },
    ];

    const res = await getMyContracts();

    expect(res.contracts).toHaveLength(2);
    expect(res.contracts.map((c) => c.status)).toEqual(["draft", "active"]);
  });

  it("derives patientSigned from contract_signatures", async () => {
    contractsResult.data = [{ id: "contract-1", status: "draft", title: "Rascunho" }];
    signaturesListResult.data = [{ contract_id: "contract-1" }];

    const res = await getMyContracts();

    expect(res.contracts[0]?.patientSigned).toBe(true);
  });

  it("returns an empty list when the patient has no linked patient record", async () => {
    patientRow.data = null;

    const res = await getMyContracts();

    expect(res.contracts).toEqual([]);
    expect(res.error).toBeTruthy();
  });
});

describe("getMyContractById", () => {
  beforeEach(() => {
    patientRow.data = { id: "patient-1" };
    contractByIdResult.data = null;
    signatureByIdResult.data = null;
    changeRequestsResult.data = [];
  });

  it("returns a draft contract when found", async () => {
    contractByIdResult.data = { id: "contract-1", status: "draft", title: "Rascunho" };

    const res = await getMyContractById("contract-1");

    expect(res.contract?.status).toBe("draft");
    expect(res.error).toBeUndefined();
  });

  it("returns an error when no matching draft/active contract exists", async () => {
    contractByIdResult.data = null;

    const res = await getMyContractById("contract-1");

    expect(res.contract).toBeNull();
    expect(res.error).toBeTruthy();
  });

  it("derives patientSigned true when a matching contract_signatures row exists", async () => {
    contractByIdResult.data = { id: "contract-1", status: "active", title: "Ativo" };
    signatureByIdResult.data = { id: "signature-1" };

    const res = await getMyContractById("contract-1");

    expect(res.contract?.patientSigned).toBe(true);
  });

  it("derives patientSigned false when no matching contract_signatures row exists", async () => {
    contractByIdResult.data = { id: "contract-1", status: "active", title: "Ativo" };
    signatureByIdResult.data = null;

    const res = await getMyContractById("contract-1");

    expect(res.contract?.patientSigned).toBe(false);
  });
});
