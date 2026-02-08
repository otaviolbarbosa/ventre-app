import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!;

// JWT for Google OAuth2 token exchange
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
  const pemContent = key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
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
      const errorData = await response.json();
      const errorCode = errorData?.error?.details?.[0]?.errorCode;
      const invalidToken =
        errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT";
      return { success: false, invalidToken };
    }

    return { success: true, invalidToken: false };
  } catch {
    return { success: false, invalidToken: false };
  }
}

Deno.serve(async (req) => {
  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending scheduled notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .is("processed_at", null)
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    const accessToken = await getAccessToken();
    let processedCount = 0;

    for (const notification of pendingNotifications) {
      const { notification_type, reference_id, reference_type, payload } = notification;

      let userIds: string[] = [];
      let title = "";
      let body = "";
      let data: Record<string, string> = {};

      if (notification_type === "appointment_reminder" && reference_type === "appointment") {
        // Get appointment details
        const { data: appointment } = await supabase
          .from("appointments")
          .select("*, patient:patients!appointments_patient_id_fkey(id, name, user_id)")
          .eq("id", reference_id)
          .single();

        if (!appointment || appointment.status !== "agendada") {
          // Mark as processed (appointment no longer valid)
          await supabase
            .from("scheduled_notifications")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", notification.id);
          processedCount++;
          continue;
        }

        const reminderType = payload?.reminder_type === "1_hour" ? "1 hora" : "1 dia";
        title = "Lembrete de consulta";
        body = `Sua consulta com ${appointment.patient?.name} é em ${reminderType}.`;
        data = { url: "/appointments", type: "appointment_reminder" };

        // Notify professional
        userIds.push(appointment.professional_id);

        // Notify patient if they have a user account
        if (appointment.patient?.user_id) {
          userIds.push(appointment.patient.user_id);
        }
      } else if (notification_type === "dpp_approaching" && reference_type === "patient") {
        // Get patient team members
        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("professional_id")
          .eq("patient_id", reference_id);

        userIds = (teamMembers ?? []).map((tm: { professional_id: string }) => tm.professional_id);

        title = "DPP se aproximando";
        body = `A data provável de parto de ${payload?.patient_name} é em ${payload?.days_until_dpp} dias.`;
        data = { url: `/patients/${reference_id}`, type: "dpp_approaching" };
      }

      // Send to each user
      for (const userId of userIds) {
        // Check settings
        const { data: settings } = await supabase
          .from("notification_settings")
          .select(notification_type)
          .eq("user_id", userId)
          .single();

        if (settings && settings[notification_type] === false) continue;

        // Get user's FCM tokens
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("fcm_token")
          .eq("user_id", userId)
          .eq("is_active", true);

        const tokens = (subscriptions ?? []).map((s: { fcm_token: string }) => s.fcm_token);

        for (const token of tokens) {
          const result = await sendFcmMessage(accessToken, token, title, body, data);
          if (result.invalidToken) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("fcm_token", token);
          }
        }

        // Store in notification history
        await supabase.from("notifications").insert({
          user_id: userId,
          type: notification_type,
          title,
          body,
          data,
        });
      }

      // Mark as processed
      await supabase
        .from("scheduled_notifications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", notification.id);

      processedCount++;
    }

    return new Response(JSON.stringify({ processed: processedCount }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
