import { sendNotificationToUser } from "@/lib/notifications/send";
import { getServerAuth } from "@/lib/server-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { user } = await getServerAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await sendNotificationToUser(user.id, {
    type: "team_invite_accepted",
    title: "Teste de notificação",
    body: "Se você está vendo isso, está funcionando!",
    data: { url: "/home" },
  });

  return NextResponse.json({ ok: true });
}
