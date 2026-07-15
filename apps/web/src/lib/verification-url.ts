export function buildVerificationUrl(code: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/check/${code}`;
}
