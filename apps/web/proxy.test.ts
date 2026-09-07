import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { proxy } from "./proxy";

type Profile = { user_type: string; professional_type: string | null } | null;
type AmrEntry = { method: string; timestamp?: number };

function chainable(result: { data: unknown; error: null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

function mockSupabaseClient({
  user,
  amr,
  profile = null,
  hasEnterprise = false,
}: {
  user: { id: string } | null;
  amr?: AmrEntry[];
  profile?: Profile;
  hasEnterprise?: boolean;
}) {
  return {
    auth: {
      getClaims: vi.fn(async () =>
        user
          ? { data: { claims: { sub: user.id, amr } }, error: null }
          : { data: null, error: null },
      ),
    },
    from: vi.fn((table: string) => {
      if (table === "users") return chainable({ data: profile, error: null });
      if (table === "user_enterprises") {
        return chainable({
          data: hasEnterprise ? { enterprise_id: "ent-1" } : null,
          error: null,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    }),
  };
}

function request(pathname: string) {
  return new NextRequest(new URL(`https://ventre.app${pathname}`));
}

function redirectPathname(response: Response) {
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  return new URL(location as string).pathname;
}

describe("proxy", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it("lets an unauthenticated user reach a public route", async () => {
    createServerClientMock.mockReturnValue(mockSupabaseClient({ user: null }));

    const response = await proxy(request("/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated user away from a protected route, preserving redirectTo", async () => {
    createServerClientMock.mockReturnValue(mockSupabaseClient({ user: null }));

    const response = await proxy(request("/home"));

    const location = new URL(response.headers.get("location") as string);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirectTo")).toBe("/home");
  });

  it("redirects an authenticated user away from /login to /home", async () => {
    createServerClientMock.mockReturnValue(
      mockSupabaseClient({
        user: { id: "user-1" },
        profile: { user_type: "patient", professional_type: null },
      }),
    );

    const response = await proxy(request("/login"));

    expect(redirectPathname(response)).toBe("/home");
  });

  it("sends a professional with incomplete onboarding to /onboarding", async () => {
    createServerClientMock.mockReturnValue(
      mockSupabaseClient({
        user: { id: "user-1" },
        profile: { user_type: "professional", professional_type: null },
      }),
    );

    const response = await proxy(request("/home"));

    expect(redirectPathname(response)).toBe("/onboarding");
  });

  // Regression test for the password-recovery bug: the callback route lands an
  // authenticated-but-onboarding-incomplete user on /reset-password, and the
  // onboarding gate below must not bounce them to /onboarding before they can
  // set a new password.
  it("does not divert an onboarding-incomplete user away from /reset-password", async () => {
    createServerClientMock.mockReturnValue(
      mockSupabaseClient({
        user: { id: "user-1" },
        profile: { user_type: "professional", professional_type: null },
      }),
    );

    const response = await proxy(request("/reset-password"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a patient away from a professional-only route", async () => {
    createServerClientMock.mockReturnValue(
      mockSupabaseClient({
        user: { id: "user-1" },
        profile: { user_type: "patient", professional_type: null },
      }),
    );

    const response = await proxy(request("/patients"));

    expect(redirectPathname(response)).toBe("/home");
  });

  // Security gate: clicking the password-recovery email link authenticates the browser
  // (proxy.ts's own /auth/callback exchanges the code for a real session) before a new
  // password is set. Without this, that session could reach the rest of the app — not
  // just the reset form — via the same single-use link.
  describe("password-recovery session confinement", () => {
    it("redirects a recovery session away from any route other than /reset-password", async () => {
      createServerClientMock.mockReturnValue(
        mockSupabaseClient({
          user: { id: "user-1" },
          amr: [{ method: "recovery", timestamp: 1 }],
          profile: { user_type: "patient", professional_type: null },
        }),
      );

      const response = await proxy(request("/home"));

      expect(redirectPathname(response)).toBe("/reset-password");
    });

    it("redirects a recovery session away from a normally-public route too", async () => {
      createServerClientMock.mockReturnValue(
        mockSupabaseClient({
          user: { id: "user-1" },
          amr: [{ method: "recovery", timestamp: 1 }],
        }),
      );

      const response = await proxy(request("/terms"));

      expect(redirectPathname(response)).toBe("/reset-password");
    });

    it("lets a recovery session reach /reset-password itself", async () => {
      createServerClientMock.mockReturnValue(
        mockSupabaseClient({
          user: { id: "user-1" },
          amr: [{ method: "recovery", timestamp: 1 }],
        }),
      );

      const response = await proxy(request("/reset-password"));

      expect(response.headers.get("location")).toBeNull();
    });

    it("does not confine a normal password-login session to /reset-password", async () => {
      createServerClientMock.mockReturnValue(
        mockSupabaseClient({
          user: { id: "user-1" },
          amr: [{ method: "password", timestamp: 1 }],
          profile: { user_type: "patient", professional_type: null },
        }),
      );

      const response = await proxy(request("/home"));

      expect(response.headers.get("location")).toBeNull();
    });
  });
});
