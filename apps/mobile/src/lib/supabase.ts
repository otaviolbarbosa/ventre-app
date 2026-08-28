import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@ventre/supabase/types";

// TODO: apps/mobile não tem hoje nenhum mecanismo de variável de ambiente
// (sem .env, sem app.config.ts). Hardcoded para o ambiente de dev, mesma
// prática já usada para o webClientId do Google em google-signin.ts — a
// publishable key é pública por design (mesmo projeto Supabase de apps/web,
// obtido via MCP get_project_url/get_publishable_keys).
const SUPABASE_URL = "https://osnpmadayhignmkpoevr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-TLz93IDr7gNagHTN3YyvQ_nwEp1PFo";

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
