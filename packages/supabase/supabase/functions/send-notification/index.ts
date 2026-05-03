// @ts-nocheck
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") as string;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") as string;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY") as string;

// ── Firebase helpers ────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const pemContent = key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header}.${payload}.${sig}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  return data.access_token;
}

async function sendFcmMessage(
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ success: boolean; invalidToken: boolean }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data,
            webpush: { fcm_options: { link: data?.url || "/home" } },
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.json();
      const code = err?.error?.details?.[0]?.errorCode;
      return { success: false, invalidToken: code === "UNREGISTERED" || code === "INVALID_ARGUMENT" };
    }

    return { success: true, invalidToken: false };
  } catch {
    return { success: false, invalidToken: false };
  }
}

// ── Supabase helpers ────────────────────────────────────────────────────────

async function getPatientName(supabase: SupabaseClient, patientId: string): Promise<string> {
  const { data } = await supabase.from("patients").select("name").eq("id", patientId).single();
  return data?.name ?? "gestante";
}

async function getUserName(supabase: SupabaseClient, userId: string | null): Promise<string> {
  if (!userId) return "Profissional";
  const { data } = await supabase.from("users").select("name").eq("id", userId).single();
  return data?.name ?? "Profissional";
}

async function getPatientIdFromPregnancy(supabase: SupabaseClient, pregnancyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("pregnancies")
    .select("patient_id")
    .eq("id", pregnancyId)
    .single();
  return data?.patient_id ?? null;
}

async function getTeamForPatient(supabase: SupabaseClient, patientId: string): Promise<string[]> {
  const { data } = await supabase
    .from("team_members")
    .select("professional_id")
    .eq("patient_id", patientId);
  return (data ?? []).map((m: { professional_id: string }) => m.professional_id);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ── Delivery ────────────────────────────────────────────────────────────────

type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

async function deliverToUser(
  supabase: SupabaseClient,
  accessToken: string,
  userId: string,
  notification: NotificationPayload,
) {
  // Check per-user opt-out
  const { data: settings } = await supabase
    .from("notification_settings")
    .select(notification.type)
    .eq("user_id", userId)
    .single();

  if (settings && settings[notification.type] === false) return;

  // Get active FCM tokens
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("fcm_token")
    .eq("user_id", userId)
    .eq("is_active", true);

  const tokens = (subscriptions ?? []).map((s: { fcm_token: string }) => s.fcm_token);

  for (const token of tokens) {
    const result = await sendFcmMessage(
      accessToken,
      token,
      notification.title,
      notification.body,
      notification.data,
    );
    if (result.invalidToken) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .eq("fcm_token", token);
    }
  }

  // Persist in notification history
  await supabase.from("notifications").insert({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });
}

async function deliverToRecipients(
  supabase: SupabaseClient,
  accessToken: string,
  recipientIds: string[],
  notification: NotificationPayload,
) {
  const unique = [...new Set(recipientIds)];
  await Promise.allSettled(
    unique.map((id) => deliverToUser(supabase, accessToken, id, notification)),
  );
}

// ── Event handlers ──────────────────────────────────────────────────────────

type HandlerResult = {
  recipientIds: string[];
  notification: NotificationPayload;
} | null;

async function handleEvent(
  supabase: SupabaseClient,
  event: string,
  triggeredBy: string | null,
  data: Record<string, unknown>,
): Promise<HandlerResult> {
  switch (event) {
    // ── appointments ────────────────────────────────────────────────────────
    case "appointment_created": {
      const patientName = await getPatientName(supabase, data.patient_id);
      return {
        recipientIds: [data.professional_id].filter((id) => id && id !== triggeredBy),
        notification: {
          type: "appointment_created",
          title: "Nova consulta agendada",
          body: `Consulta com ${patientName} em ${data.date} às ${data.time?.slice(0, 5)}.`,
          data: { category: "appointments", type: "appointment_created", url: "/appointments" },
        },
      };
    }

    case "appointment_updated": {
      const patientName = await getPatientName(supabase, data.patient_id);
      return {
        recipientIds: [data.professional_id].filter((id) => id && id !== triggeredBy),
        notification: {
          type: "appointment_updated",
          title: "Consulta atualizada",
          body: `A consulta com ${patientName} foi alterada para ${data.date} às ${data.time?.slice(0, 5)}.`,
          data: { category: "appointments", type: "appointment_updated", url: "/appointments" },
        },
      };
    }

    case "appointment_cancelled": {
      const patientName = await getPatientName(supabase, data.patient_id);
      return {
        recipientIds: [data.professional_id].filter((id) => id && id !== triggeredBy),
        notification: {
          type: "appointment_cancelled",
          title: "Consulta cancelada",
          body: `A consulta com ${patientName} em ${data.date} foi cancelada.`,
          data: { category: "appointments", type: "appointment_cancelled", url: "/appointments" },
        },
      };
    }

    // ── billing ─────────────────────────────────────────────────────────────
    case "billing_created": {
      const professionalIds: string[] = data.splitted_billing
        ? Object.keys(data.splitted_billing)
        : [];
      return {
        recipientIds: professionalIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "billing_created",
          title: "Nova cobrança criada",
          body: `${data.description} — ${formatBRL(data.total_amount)}`,
          data: {
            category: "billing",
            id: data.billing_id,
            type: "billing_created",
            url: `/patients/${data.patient_id}/billing`,
          },
        },
      };
    }

    case "billing_payment_received": {
      const { data: installment } = await supabase
        .from("installments")
        .select("installment_number, billing_id, billings(id, patient_id, description, splitted_billing)")
        .eq("id", data.installment_id)
        .single();

      if (!installment?.billings) return null;

      const billing = installment.billings;
      const professionalIds: string[] = billing.splitted_billing
        ? Object.keys(billing.splitted_billing)
        : [];

      return {
        recipientIds: professionalIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "billing_payment_received",
          title: "Pagamento registrado",
          body: `Parcela ${installment.installment_number} de ${billing.description} — ${formatBRL(data.paid_amount)}`,
          data: {
            category: "billing",
            id: billing.id,
            type: "billing_payment_received",
            url: `/patients/${billing.patient_id}/billing`,
          },
        },
      };
    }

    // ── patients / team ──────────────────────────────────────────────────────
    case "patient_added": {
      const patientName = await getPatientName(supabase, data.patient_id);
      return {
        recipientIds: [data.professional_id].filter((id) => id && id !== triggeredBy),
        notification: {
          type: "patient_added",
          title: "Nova gestante cadastrada",
          body: `${patientName} foi adicionada à sua lista de gestantes.`,
          data: {
            category: "patients",
            id: data.patient_id,
            type: "patient_added",
            url: `/patients/${data.patient_id}`,
          },
        },
      };
    }

    case "team_member_added": {
      const [patientName, professionalName, teamIds] = await Promise.all([
        getPatientName(supabase, data.patient_id),
        getUserName(supabase, data.professional_id),
        getTeamForPatient(supabase, data.patient_id),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "team_member_added",
          title: "Nova profissional na equipe",
          body: `${professionalName} foi adicionada à equipe de ${patientName}.`,
          data: {
            category: "team_members",
            id: data.patient_id,
            type: "team_member_added",
            url: `/patients/${data.patient_id}`,
          },
        },
      };
    }

    // ── invites ──────────────────────────────────────────────────────────────
    case "team_invite_received": {
      const [patientName, inviterName] = await Promise.all([
        getPatientName(supabase, data.patient_id),
        getUserName(supabase, data.invited_by),
      ]);
      return {
        recipientIds: [data.invited_professional_id].filter((id) => id && id !== triggeredBy),
        notification: {
          type: "team_invite_received",
          title: "Novo convite de equipe",
          body: `${inviterName} convidou você para a equipe de ${patientName}.`,
          data: {
            category: "invites",
            id: data.invite_id,
            type: "team_invite_received",
            url: "/invites",
          },
        },
      };
    }

    // ── evolutions / clinical ────────────────────────────────────────────────
    case "evolution_added": {
      const [patientName, professionalName, teamIds] = await Promise.all([
        getPatientName(supabase, data.patient_id),
        getUserName(supabase, data.professional_id ?? triggeredBy),
        getTeamForPatient(supabase, data.patient_id),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "evolution_added",
          title: "Nova evolução registrada",
          body: `${professionalName} adicionou uma evolução para ${patientName}.`,
          data: {
            category: "patients",
            id: data.patient_id,
            type: "evolution_added",
            url: `/patients/${data.patient_id}`,
          },
        },
      };
    }

    case "document_uploaded": {
      const [patientName, uploaderName, teamIds] = await Promise.all([
        getPatientName(supabase, data.patient_id),
        getUserName(supabase, data.uploaded_by ?? triggeredBy),
        getTeamForPatient(supabase, data.patient_id),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "document_uploaded",
          title: "Novo documento",
          body: `${uploaderName} enviou "${data.file_name}" para ${patientName}.`,
          data: {
            category: "patient_documents",
            id: data.document_id,
            type: "document_uploaded",
            url: `/patients/${data.patient_id}`,
          },
        },
      };
    }

    case "obstetric_history_updated": {
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, data.patient_id),
        getTeamForPatient(supabase, data.patient_id),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "obstetric_history_updated",
          title: "Histórico obstétrico atualizado",
          body: `O histórico obstétrico de ${patientName} foi atualizado.`,
          data: {
            category: "obstetric_history",
            id: data.patient_id,
            type: "obstetric_history_updated",
            url: `/patients/${data.patient_id}`,
          },
        },
      };
    }

    case "risk_factors_updated": {
      const patientId = await getPatientIdFromPregnancy(supabase, data.pregnancy_id);
      if (!patientId) return null;
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, patientId),
        getTeamForPatient(supabase, patientId),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "risk_factors_updated",
          title: "Fatores de risco atualizados",
          body: `Os fatores de risco de ${patientName} foram atualizados.`,
          data: {
            category: "risk_factors",
            id: patientId,
            type: "risk_factors_updated",
            url: `/patients/${patientId}`,
          },
        },
      };
    }

    case "pregnancy_evolution_added": {
      const patientId = await getPatientIdFromPregnancy(supabase, data.pregnancy_id);
      if (!patientId) return null;
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, patientId),
        getTeamForPatient(supabase, patientId),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "pregnancy_evolution_added",
          title: "Nova evolução gestacional",
          body: `Evolução gestacional registrada para ${patientName}.`,
          data: {
            category: "patients",
            id: patientId,
            type: "pregnancy_evolution_added",
            url: `/patients/${patientId}`,
          },
        },
      };
    }

    case "lab_exam_added": {
      const patientId = await getPatientIdFromPregnancy(supabase, data.pregnancy_id);
      if (!patientId) return null;
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, patientId),
        getTeamForPatient(supabase, patientId),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "lab_exam_added",
          title: "Novo exame laboratorial",
          body: `Exame laboratorial registrado para ${patientName}.`,
          data: {
            category: "lab_exams",
            id: patientId,
            type: "lab_exam_added",
            url: `/patients/${patientId}`,
          },
        },
      };
    }

    case "other_exam_added": {
      const patientId = await getPatientIdFromPregnancy(supabase, data.pregnancy_id);
      if (!patientId) return null;
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, patientId),
        getTeamForPatient(supabase, patientId),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "other_exam_added",
          title: "Novo exame registrado",
          body: `Exame registrado para ${patientName}.`,
          data: {
            category: "other_exams",
            id: patientId,
            type: "other_exam_added",
            url: `/patients/${patientId}`,
          },
        },
      };
    }

    case "ultrasound_added": {
      const patientId = await getPatientIdFromPregnancy(supabase, data.pregnancy_id);
      if (!patientId) return null;
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, patientId),
        getTeamForPatient(supabase, patientId),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "ultrasound_added",
          title: "Novo ultrassom registrado",
          body: `Ultrassom registrado para ${patientName}.`,
          data: {
            category: "ultrasounds",
            id: patientId,
            type: "ultrasound_added",
            url: `/patients/${patientId}`,
          },
        },
      };
    }

    case "vaccine_updated": {
      const patientId = await getPatientIdFromPregnancy(supabase, data.pregnancy_id);
      if (!patientId) return null;
      const [patientName, teamIds] = await Promise.all([
        getPatientName(supabase, patientId),
        getTeamForPatient(supabase, patientId),
      ]);
      return {
        recipientIds: teamIds.filter((id) => id !== triggeredBy),
        notification: {
          type: "vaccine_updated",
          title: "Vacina atualizada",
          body: `Vacina de ${patientName} atualizada.`,
          data: {
            category: "vaccines",
            id: patientId,
            type: "vaccine_updated",
            url: `/patients/${patientId}`,
          },
        },
      };
    }

    default:
      return null;
  }
}

// ── Server ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { event, triggered_by, data } = await req.json();

    if (!event || !data) {
      return new Response(JSON.stringify({ error: "Missing event or data" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const accessToken = await getAccessToken();

    const result = await handleEvent(supabase, event, triggered_by ?? null, data);

    if (!result || result.recipientIds.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), { status: 200 });
    }

    await deliverToRecipients(supabase, accessToken, result.recipientIds, result.notification);

    return new Response(
      JSON.stringify({ delivered: result.recipientIds.length }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
