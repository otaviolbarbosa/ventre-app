import { createEvolutionSchema } from "@/lib/validations/evolution";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import { NextResponse } from "next/server";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: evolutions, error } = await supabase
      .from("patient_evolutions")
      .select("*, professional:professional_id(id, name)")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ evolutions: evolutions ?? [] });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: patientId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createEvolutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { data: evolution, error } = await supabase
      .from("patient_evolutions")
      .insert({
        patient_id: patientId,
        professional_id: user.id,
        content: parsed.data.content,
      })
      .select("*, professional:professional_id(id, name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget: notify team about new evolution
    const [{ data: professionalProfile }, { data: patient }] = await Promise.all([
      supabase.from("users").select("name").eq("id", user.id).single(),
      supabase.from("patients").select("name").eq("id", patientId).single(),
    ]);

    if (professionalProfile && patient) {
      const template = getNotificationTemplate("evolution_added", {
        professionalName: professionalProfile.name,
        patientName: patient.name,
      });
      sendNotificationToTeam(patientId, user.id, {
        type: "evolution_added",
        ...template,
        data: { url: `/patients/${patientId}` },
      });
    }

    return NextResponse.json({ evolution }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
