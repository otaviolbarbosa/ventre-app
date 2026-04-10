import { resend } from "@/lib/resend";
import { professionalTypeLabels } from "@/utils/team";

type SendProfessionalInviteParams = {
  to: string;
  name: string;
  enterpriseName: string;
  professional_type: string;
  inviteLink: string;
};

export async function sendProfessionalInvite({
  to,
  name,
  enterpriseName,
  professional_type,
  inviteLink,
}: SendProfessionalInviteParams) {
  const typeLabel = professionalTypeLabels[professional_type] ?? professional_type;

  const { error } = await resend.emails.send({
    from: "Ventre <naoresponda@ventre.app>",
    to,
    subject: `${enterpriseName} te convidou para o Ventre`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Convite — Ventre</title>
</head>

<body style="margin:0;padding:0;background-color:#FFFAF5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFAF5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://ventre.app/logo.png" alt="Ventre" width="140"
                style="display:block;object-fit:contain;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;padding:48px 40px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

              <!-- Heading -->
              <p style="margin:0 0 6px;font-size:12px;font-weight:400;letter-spacing:0.1em;text-transform:uppercase;color:#81726C;text-align:center;">
                Convite da equipe
              </p>
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#433831;text-align:center;line-height:1.3;">
                Você foi convidada para o Ventre
              </h1>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <div style="width:40px;height:2px;background-color:#f3e8f5;border-radius:2px;"></div>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#81726C;text-align:center;">
                Olá, <strong style="color:#433831;">${name}</strong>! A clínica <strong style="color:#433831;">${enterpriseName}</strong> te convidou para fazer parte da equipe no <strong style="color:#1a1a1a;">Ventre</strong> como <strong style="color:#433831;">${typeLabel}</strong>. Clique no botão abaixo para finalizar seu cadastro.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}"
                      style="display:inline-block;background:linear-gradient(135deg,#be5237,#7a2930);color:#ffffff;font-size:15px;font-weight:400;text-decoration:none;padding:14px 36px;border-radius:100px;letter-spacing:0.01em;">
                      Finalizar cadastro
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0;font-size:12px;color:#999999;text-align:center;line-height:1.6;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="${inviteLink}" style="color:#9b59a8;word-break:break-all;">
                  ${inviteLink}
                </a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#aaaaaa;">
                Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este e-mail com segurança.
              </p>
              <p style="margin:0;font-size:12px;color:#cccccc;">
                © Ventre — Plataforma de Gestão Obstétrica ${new Date().getFullYear()}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>

</html>
    `,
  });

  if (error) {
    console.log(error);
    throw new Error("Erro ao enviar e-mail de convite.");
  }
}
