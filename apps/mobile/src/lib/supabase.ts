import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@ventre/supabase/types";

// EXPO_PUBLIC_SUPABASE_URL/ANON_KEY set per profile in eas.json — same pattern
// already used for EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Falls back to the dev
// project (ventre-db-dev) for local runs with no EAS profile involved (plain
// `expo run:ios`/`expo run:android`), same reasoning as APP_VARIANT in
// app.config.js: a stray unset var should never silently talk to prod. The
// publishable key is public by design.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://osnpmadayhignmkpoevr.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_-TLz93IDr7gNagHTN3YyvQ_nwEp1PFo";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
