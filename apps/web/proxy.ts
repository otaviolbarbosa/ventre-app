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
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("users")
      .select("user_type, professional_type")
      .eq("id", user.id)
      .single();

    const isStaff = profile?.user_type === "manager" || profile?.user_type === "secretary";

    let hasEnterprise = false;
    if (isStaff) {
      const { data: ueRow } = await supabase
        .from("user_enterprises")
        .select("enterprise_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      hasEnterprise = ueRow?.enterprise_id != null;
    }

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
