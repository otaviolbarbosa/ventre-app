import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const intent = searchParams.get("intent");
  const piid = searchParams.get("piid");
  const nextParam = searchParams.get("next") ?? "/home";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options);
              }
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Persist Google Calendar tokens when intent is google_calendar
      if (intent === "google_calendar" && data.session?.provider_token) {
        try {
          const admin = await createServerSupabaseAdmin();
          await admin.from("user_google_tokens").upsert(
            {
              user_id: data.session.user.id,
              access_token: data.session.provider_token,
              refresh_token: data.session.provider_refresh_token ?? undefined,
              expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            },
            { onConflict: "user_id" },
          );
        } catch (tokenErr) {
          console.error("[auth/callback] failed to persist google calendar tokens", tokenErr);
        }
      }

      // Patient self-registration via Google: mark as patient, send to the
      // post-OAuth data-completion step (no auth.signUp step needed here).
      if (intent === "patient_invite" && piid) {
        try {
          const admin = await createServerSupabaseAdmin();
          await admin
            .from("users")
            .update({ user_type: "patient" })
            .eq("id", data.session.user.id);
        } catch (patientErr) {
          console.error("[auth/callback] failed to set patient user_type", patientErr);
        }

        return NextResponse.redirect(`${origin}/patient-registration/complete?piid=${piid}`);
      }

      // Handle password recovery
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
