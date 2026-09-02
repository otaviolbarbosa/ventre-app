export function buildPaymentLinkRedirectUrl({
  paymentLinkUrl,
  userId,
  email,
}: {
  paymentLinkUrl: string;
  userId: string;
  email: string;
}): string {
  const url = new URL(paymentLinkUrl);
  url.searchParams.set("client_reference_id", userId);
  url.searchParams.set("prefilled_email", email);
  return url.toString();
}
