import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const SUBSCRIPTION_ID = "22222222-2222-2222-2222-222222222222";
const PLAN_ID = "33333333-3333-3333-3333-333333333333";

const { authUser, subscriptionRow, paymentLinkResult } = vi.hoisted(() => ({
  authUser: { id: "11111111-1111-1111-1111-111111111111", email: "maria@example.com" },
  subscriptionRow: {
    data: {
      id: "22222222-2222-2222-2222-222222222222",
      plan_id: "33333333-3333-3333-3333-333333333333",
      frequence: "month",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  paymentLinkResult: {
    data: { payment_link_url: "https://buy.stripe.com/test_abc123" } as Record<
      string,
      unknown
    > | null,
    error: null as unknown,
  },
}));

const rpcCalls: { name: string; args: unknown }[] = [];

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
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
      if (table === "users")
        return makeQueryBuilder({
          data: { id: authUser.id, user_type: "professional" },
          error: null,
        });
      if (table === "subscriptions") return makeQueryBuilder(subscriptionRow);
      throw new Error(`unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(paymentLinkResult);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));

import { getReactivationPaymentLinkAction } from "./get-reactivation-payment-link-action";

describe("getReactivationPaymentLinkAction", () => {
  beforeEach(() => {
    subscriptionRow.data = { id: SUBSCRIPTION_ID, plan_id: PLAN_ID, frequence: "month" };
    subscriptionRow.error = null;
    paymentLinkResult.data = { payment_link_url: "https://buy.stripe.com/test_abc123" };
    paymentLinkResult.error = null;
    rpcCalls.length = 0;
  });

  it("retorna a URL do payment link do plano antigo, com client_reference_id e email", async () => {
    const res = await getReactivationPaymentLinkAction({ subscriptionId: SUBSCRIPTION_ID });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.url).toBe(
      `https://buy.stripe.com/test_abc123?client_reference_id=${USER_ID}&prefilled_email=maria%40example.com`,
    );
    expect(rpcCalls[0]).toEqual({
      name: "get_active_payment_link",
      args: { p_plan_id: PLAN_ID, p_frequence: "month" },
    });
  });

  it("retorna url null quando não há payment link ativo pro plano antigo", async () => {
    paymentLinkResult.data = null;

    const res = await getReactivationPaymentLinkAction({ subscriptionId: SUBSCRIPTION_ID });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.url).toBeNull();
  });

  it("rejeita quando a assinatura não pertence ao usuário", async () => {
    subscriptionRow.data = null;
    subscriptionRow.error = { message: "not found" };

    const res = await getReactivationPaymentLinkAction({ subscriptionId: SUBSCRIPTION_ID });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
