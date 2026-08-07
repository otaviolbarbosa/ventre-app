// Implementação própria — o app é Brasil-only hoje, sem dependência externa.
export function normalizePhoneToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  // Já vem com código do país (55 + DDD + número): 12 dígitos (fixo) ou 13 (celular).
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Formato local sem código do país: 10 dígitos (fixo) ou 11 (celular).
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return null;
}
