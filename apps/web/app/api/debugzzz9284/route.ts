import { getServerAuth } from "@/lib/server-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, profile } = await getServerAuth();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    profile,
  });
}
