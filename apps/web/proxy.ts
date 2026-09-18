import { mustHaveActiveSubscription } from "@/lib/access-control";
import {
  readCachedFlagCookie,
  resolveDisableSubscriptionAccessFlag,
} from "@/lib/posthog/edge-flags";
import { shouldRedirectToPaywall } from "@/lib/subscription-gate";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          }

          supabaseResponse = NextResponse.next({
            request,
          });
        },
      },
    },
  );

  // getClaims() gives the same server-verified trust as getUser() (it falls back to
  // getUser() internally when the project uses symmetric signing keys) plus the decoded
  // JWT claims, which is how we detect a password-recovery session below.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const user = claims ? { id: claims.sub } : null;

  const { pathname } = request.nextUrl;

  // A session minted from a password-recovery email link carries amr: [{ method: "recovery" }]
  // — Supabase's documented signal for this exact case (https://supabase.com/docs/guides/auth/jwt-fields).
  // Clicking that link authenticates the browser immediately, before a new password is set, so
  // without this gate anyone with the (single-use, ~1h) link could browse the whole app as the
  // user instead of only reaching the reset-password form. Confine the session to that route
  // until a new password replaces it; reset-password/page.tsx signs the session out on success
  // (updateUser() doesn't clear this amr entry from the current session's token).
  const isRecoverySession =
    claims?.amr?.some(
      (entry) => (typeof entry === "string" ? entry : entry.method) === "recovery",
    ) ?? false;
  if (isRecoverySession && pathname !== "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/reset-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/complete-registration",
    "/paywall",
    "/landing",
    "/welcome",
    "/terms",
    "/policies",
    "/check/",
    "/auth/callback",
    "/reset-password",
    "/patient-registration",
    "/api/stripe/webhook",
    "/api/check/",
    "/api/cron/",
    "/api/whatsapp/webhook",
    "/api/patient-registration/",
    "/api/auth/native-session",
  ];
  const isPublicRoute =
    pathname === "/" || publicRoutes.some((route) => pathname.startsWith(route));

  // A Server Action invocation is itself a POST to the current page — if middleware
  // redirects that request, the client's action runtime can't parse the response
  // (it expects an action-flight response, not a plain redirect) and throws
  // "An unexpected response was received from the server." Let the action run; if it
  // needs to redirect, its own redirect() call produces a normal follow-up navigation
  // that this middleware gates as usual.
  const isServerActionRequest = request.headers.has("next-action");

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and trying to access auth pages
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  // Onboarding gate for authenticated users on protected routes
  if (user && !isPublicRoute && !isServerActionRequest) {
    const { data: profile } = await supabase
      .from("users")
      .select("user_type, professional_type")
      .eq("id", user.id)
      .single();

    const isStaff = profile?.user_type === "manager" || profile?.user_type === "secretary";

    let enterpriseId: string | null = null;
    if (isStaff) {
      const { data: ueRow } = await supabase
        .from("user_enterprises")
        .select("enterprise_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      enterpriseId = ueRow?.enterprise_id ?? null;
    }
    const hasEnterprise = enterpriseId != null;

    const isOnboardingComplete =
      profile?.user_type === "patient" ||
      (profile?.user_type === "professional" && profile?.professional_type !== null) ||
      (isStaff && hasEnterprise);

    if (!isOnboardingComplete && pathname !== "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (isOnboardingComplete && pathname === "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }

    // Professionals/staff need an active subscription once onboarded (patients never do).
    // This must live here rather than in a layout: Next.js doesn't re-run a shared layout
    // on a client-side navigation between sibling routes it wraps (e.g. the onboarding
    // action's redirect("/home") right after finishing onboarding), so a layout-based gate
    // silently gets skipped on exactly that transition. Middleware runs on every request.
    // biome-ignore lint/suspicious/noExplicitAny: shape for the pure gate helpers, not a full users row
    const subscriptionProfile: any = {
      user_type: profile?.user_type,
      professional_type: profile?.professional_type,
      enterprise_id: enterpriseId,
    };

    if (mustHaveActiveSubscription(subscriptionProfile)) {
      const cachedFlag = readCachedFlagCookie(request.cookies);
      const { enabled: bypassEnabled, freshCookie } = await resolveDisableSubscriptionAccessFlag(
        cachedFlag,
        user.id,
      );

      const subscriptionOrFilter = enterpriseId
        ? `user_id.eq.${user.id},enterprise_id.eq.${enterpriseId}`
        : `user_id.eq.${user.id}`;

      const { data: subscriptionRows } = await supabase
        .from("subscriptions")
        .select("status, expires_at")
        .or(subscriptionOrFilter)
        .order("created_at", { ascending: false })
        .limit(1);

      const subscription = subscriptionRows?.[0] ?? null;

      if (
        shouldRedirectToPaywall({
          profile: subscriptionProfile,
          subscription,
          bypassFlagEnabled: bypassEnabled,
        })
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/paywall";
        const response = NextResponse.redirect(url);
        if (freshCookie)
          response.cookies.set(freshCookie.name, freshCookie.value, freshCookie.options);
        return response;
      }

      if (freshCookie) {
        supabaseResponse.cookies.set(freshCookie.name, freshCookie.value, freshCookie.options);
      }
    }

    // Patients only get the shared (dashboard) routes plus their own (patient) routes —
    // everything else under (dashboard) is professional/staff-only.
    const patientAllowedPrefixes = [
      "/home",
      "/profile",
      "/notifications",
      "/agenda",
      "/cartao-pre-natal",
      "/financeiro",
      "/ferramentas",
      "/contrato",
    ];
    const isPatientAllowedRoute = patientAllowedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    if (profile?.user_type === "patient" && !isPatientAllowedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|firebase-messaging-sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)",
  ],
};
