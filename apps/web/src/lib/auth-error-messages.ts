/**
 * PT-BR translations for Supabase Auth error codes (`error.code`) surfaced during the
 * password-recovery flow: forgot-password (resetPasswordForEmail), the recovery-link
 * verification (GoTrue's own /auth/v1/verify, surfaced as ?error=...#error_code=... on
 * redirect — see app/(auth)/login/page.tsx), and reset-password (updateUser).
 * Source: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // resetPasswordForEmail (forgot-password)
  over_email_send_rate_limit:
    "Muitos e-mails foram enviados para este endereço. Aguarde um pouco antes de tentar novamente.",
  over_request_rate_limit:
    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
  email_address_invalid: "Este endereço de e-mail não é válido.",
  email_address_not_authorized: "Não foi possível enviar e-mail para este endereço.",
  validation_failed: "Os dados informados não são válidos.",

  // Recovery-link verification (GoTrue's /auth/v1/verify redirect)
  otp_expired: "O link de recuperação expirou ou já foi utilizado. Solicite um novo link.",
  flow_state_expired: "O link de recuperação expirou. Solicite um novo link.",
  flow_state_not_found:
    "Este link de recuperação já foi utilizado ou não é mais válido. Solicite um novo link.",
  bad_code_verifier: "Não foi possível validar o link de recuperação. Solicite um novo link.",

  // updateUser (reset-password)
  same_password: "A nova senha deve ser diferente da senha atual.",
  weak_password: "Senha muito fraca. Escolha uma senha mais forte.",
  session_expired: "Sua sessão expirou. Solicite um novo link de recuperação.",
  session_not_found: "Sua sessão de recuperação não é mais válida. Solicite um novo link.",
  reauthentication_needed: "Por segurança, faça login novamente para concluir esta ação.",

  // Generic, can surface from any of the calls above
  unexpected_failure: "Ocorreu um erro inesperado. Tente novamente.",
  request_timeout: "A solicitação demorou demais. Tente novamente.",
  conflict: "Muitas solicitações ao mesmo tempo. Tente novamente em instantes.",
  user_not_found: "Não encontramos uma conta com este e-mail.",
};

/** Looks up the PT-BR translation for a Supabase Auth `error.code` value (e.g. from the
 * recovery-link redirect's `error_code` query/hash param). Returns undefined for an unknown
 * or missing code — callers should fall back to a generic message in that case. */
export function translateAuthErrorCode(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return AUTH_ERROR_MESSAGES[code];
}

/** Looks up the PT-BR translation for a Supabase Auth SDK error (from resetPasswordForEmail,
 * updateUser, etc.), matching on its `.code` field. Falls back to `fallback` when the error
 * has no recognized code. */
export function translateAuthError(error: unknown, fallback: string): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  return translateAuthErrorCode(typeof code === "string" ? code : undefined) ?? fallback;
}
