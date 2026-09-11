import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Sets the session server-side from tokens handed over by apps/mobile's native
// Google sign-in bridge (see apps/web/src/providers/auth-provider.tsx). The
// browser-side supabase.auth.setSession() call was observed to hang
// indefinitely specifically inside the WebView right after the native Google
// account picker Activity returns focus — confirmed the underlying token
// validation itself succeeds instantly (a raw fetch resolves in ms), so the
// hang is inside supabase-js's own client-side handling, not the network.
// Running the equivalent call here, in a plain Node.js request handler, never
// touches that broken code path — the caller does a hard navigation
// afterwards to pick up the cookies this sets.
export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json();
  if (typeof access_token !== "string" || typeof refresh_token !== "string") {
    return NextResponse.json({ error: "missing tokens" }, { status: 400 });
  }

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
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ success: true });
}
