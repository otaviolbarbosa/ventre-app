"use client";

import { invalidateUserCacheAction } from "@/actions/invalidate-user-cache-action";
import { unsubscribeNotificationsAction } from "@/actions/unsubscribe-notifications-action";
import { isManager, isPatient, isProfessional, isSecretary, isStaff } from "@/lib/access-control";
import { NATIVE_PUSH_TOKEN_KEY, isNativeBridge, requestNative } from "@/lib/native-bridge";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@ventre/supabase";
import type { Tables } from "@ventre/supabase/types";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

type UserProfile = Tables<"users">;

type GoogleSignInResult =
  | { access_token: string; refresh_token: string; error?: undefined }
  | { error: string; access_token?: undefined; refresh_token?: undefined };

// Códigos vindos de apps/mobile/src/lib/google-signin.ts (cancelled/unavailable/unknown) e do
// handler nativo em apps/mobile/src/app/index.tsx (auth-failed) — mapeados para mensagens que o
// toast em social-login-buttons.tsx pode exibir diretamente.
const GOOGLE_SIGNIN_ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Login cancelado.",
  unavailable: "Não foi possível abrir o seletor de contas do Google. Tente novamente.",
  "auth-failed": "Não foi possível autenticar com o Google. Tente novamente.",
  unknown: "Ocorreu um erro ao fazer login com o Google.",
};

function googleSignInErrorMessage(code: string) {
  return GOOGLE_SIGNIN_ERROR_MESSAGES[code] ?? GOOGLE_SIGNIN_ERROR_MESSAGES.unknown;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>;
  signUp: (
    email: string,
    password: string,
    metadata: { name: string },
  ) => Promise<{ data: unknown; error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ data: unknown; error: unknown }>;
  signInWithGoogle: (
    redirectTo?: string,
    intent?: { name: string; piid: string },
  ) => Promise<{ data: unknown; error: unknown }>;
  connectGoogleCalendar: () => Promise<void>;
  isAuthenticated: boolean;
  isProfessional: boolean;
  isObstetrician: boolean;
  isNurse: boolean;
  isDoula: boolean;
  isFisioterapeuta: boolean;
  isPatient: boolean;
  isManager: boolean;
  isSecretary: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    // Erros de rede/timeout são transitórios — sem retry, um único blip deixa o profile
    // travado em null pelo resto da sessão (TOKEN_REFRESHED não re-dispara o fetch).
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
      if (!error) {
        setProfile(data);
        return;
      }
      console.error(`[fetchProfile] tentativa ${attempt}/${maxAttempts} falhou:`, error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // getUser() revalida a sessão contra o servidor da Auth — um blip de rede aqui
      // derruba `user` para null mesmo com sessão local válida. getSession() é local
      // (lê do storage, sem round-trip) e serve de fallback nesse caso.
      if (error) {
        console.error("[getUser] erro ao validar sessão, usando sessão local:", error);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id);
      } else {
        setUser(user);
        if (user) await fetchProfile(user.id);
      }
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser((prev) => {
        if (prev?.id === session?.user?.id) return prev;
        return session?.user ?? null;
      });

      if (event === "SIGNED_OUT") {
        setProfile(null);
      } else if (event !== "TOKEN_REFRESHED" && session?.user) {
        await fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (email: string, password: string, metadata: { name: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login?confirmation=success`,
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    setLoading(true);
    if (isNativeBridge()) {
      const cachedToken = localStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
      if (cachedToken) {
        // Unsubscribe while the session is still valid — waiting for native
        // to detect the post-logout navigation and relay it back is too late,
        // the session (and the WebView document) may already be gone by then.
        await unsubscribeNotificationsAction({ fcmToken: cachedToken });
        localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
      }
    }
    await invalidateUserCacheAction({});
    const { error } = await supabase.auth.signOut();
    if (!error) {
      // Hard navigation forces the server to re-read the session from scratch,
      // evitando que o cache de server components do Next.js App Router
      // mantenha a sessão antiga após o logout.
      window.location.href = "/login";
    }

    setLoading(false);
    return { error };
  };

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    return { data, error };
  };

  const signInWithGoogle = async (redirectTo?: string, intent?: { name: string; piid: string }) => {
    if (isNativeBridge()) {
      try {
        // 60s em vez do timeout padrão de requestNative (10s) — esse round-trip inclui a usuária
        // escolhendo uma conta no seletor nativo do Google, não só uma resposta automática.
        const result = await requestNative<GoogleSignInResult>("google-signin-request", {}, 60_000);
        if (result.error || !result.access_token || !result.refresh_token) {
          return {
            data: null,
            error: new Error(googleSignInErrorMessage(result.error ?? "unknown")),
          };
        }
        const { error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        return { data: null, error };
      } catch {
        return { data: null, error: new Error(googleSignInErrorMessage("unknown")) };
      }
    }

    const intentParams = intent ? `&intent=${intent.name}&piid=${intent.piid}` : "";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo || "/home"}${intentParams}`,
      },
    });
    return { data, error };
  };

  const connectGoogleCalendar = async () => {
    // Clear stale PKCE code verifier from any previous failed OAuth attempt
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (name?.includes("code-verifier")) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.events",
        queryParams: { access_type: "offline", prompt: "consent" },
        redirectTo: `${window.location.origin}/auth/callback?next=/profile/settings&intent=google_calendar`,
      },
    });
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPassword,
    signInWithGoogle,
    connectGoogleCalendar,
    isAuthenticated: !!user,
    isProfessional: isProfessional(profile),
    isObstetrician: isProfessional(profile) && profile?.professional_type === "obstetra",
    isNurse: isProfessional(profile) && profile?.professional_type === "enfermeiro",
    isDoula: isProfessional(profile) && profile?.professional_type === "doula",
    isFisioterapeuta: isProfessional(profile) && profile?.professional_type === "fisio",
    isPatient: isPatient(profile),
    isManager: isManager(profile),
    isSecretary: isSecretary(profile),
    isStaff: isStaff(profile),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
