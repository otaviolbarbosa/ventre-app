import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// client_type: 3 (Web) do google-services.json do projeto Firebase apontado pelo build atual —
// dev (nascereapp-dev) por padrão, produção (ventre-app-prod) via EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
// setado por perfil no eas.json. Regenerado ao habilitar o provedor Google em Firebase Auth
// (necessário pra gerar o client Android/client_type:1 usado pelo Google Sign-In nativo).
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  "585581972014-6fqvigc9sjtn4jq4tt6bl4nogttlr9rn.apps.googleusercontent.com";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

export type GoogleSignInResult =
  | { idToken: string; error: null }
  | { idToken: null; error: "cancelled" | "unavailable" | "unknown" };

export async function signInWithGoogleNatively(): Promise<GoogleSignInResult> {
  try {
    ensureConfigured();
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response) || !response.data.idToken) {
      console.warn("[google-signin] resposta sem idToken:", response);
      return { idToken: null, error: "unknown" };
    }

    return { idToken: response.data.idToken, error: null };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      return { idToken: null, error: "cancelled" };
    }
    console.warn("[google-signin] falha no sign-in nativo:", err);
    return { idToken: null, error: "unavailable" };
  }
}
