import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// client_type: 3 (Web) em apps/mobile/google-services/google-services.json — projeto Firebase de
// dev (nascereapp-dev). TODO: alternar para o valor de prod (google-services/prod/google-services.json)
// quando existir mecanismo de build por ambiente.
const GOOGLE_WEB_CLIENT_ID = "585581972014-tphtalk0q1up33m2ussfi871dq40ro1o.apps.googleusercontent.com";

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
