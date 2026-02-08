import { createServerSupabaseClient } from "@nascere/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Return just the unread count if requested
    if (searchParams.get("unread_count") === "true") {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      return NextResponse.json({ unreadCount: count ?? 0 });
    }

    // Pagination
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const filter = searchParams.get("filter"); // "unread" or null

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter === "unread") {
      query = query.eq("is_read", false);
    }

    const { data: notifications, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      notifications: notifications ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { ids } = await request.json();
    const now = new Date().toISOString();

    let query = supabase
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (ids && Array.isArray(ids) && ids.length > 0) {
      query = query.in("id", ids);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
