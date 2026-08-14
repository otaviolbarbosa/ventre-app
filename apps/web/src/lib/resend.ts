import { Resend } from "resend";

let resendClient: Resend | undefined;

export function getResendClient() {
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}
