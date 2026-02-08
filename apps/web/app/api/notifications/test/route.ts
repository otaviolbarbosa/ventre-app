import { createServerSupabaseClient } from "@nascere/supabase/server";
import { sendPushNotification } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

// DELETE THIS FILE after testing - only for development
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Get user's active tokens
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("fcm_token")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        error: "Nenhum token FCM encontrado. Ative as notificações primeiro.",
      }, { status: 404 });
    }

    const results = [];
    for (const sub of subscriptions) {
      try {
        await sendPushNotification(sub.fcm_token, {
          title: "Teste de notificação",
          body: "Se você está vendo isso, as notificações push estão funcionando!",
          data: { url: "/notifications" },
        });
        results.push({ token: sub.fcm_token.slice(0, 10) + "...", status: "sent" });
      } catch (err) {
        results.push({ token: sub.fcm_token.slice(0, 10) + "...", status: "failed", error: String(err) });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
