import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import type { TablesInsert } from "@nascere/supabase/types";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    let query = supabase
      .from("appointments")
      .select(`
        *,
        patient:patients!appointments_patient_id_fkey(id, name),
        professional:users!appointments_professional_id_fkey(name, professional_type)
      `)
      .eq("professional_id", user.id)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (patientId) {
      query = query.eq("patient_id", patientId);
    }

    const { data: appointments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointments });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createAppointmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const insertData: TablesInsert<"appointments"> = {
      patient_id: validation.data.patient_id,
      professional_id: user.id,
      date: validation.data.date,
      time: validation.data.time,
      duration: validation.data.duration,
      type: validation.data.type,
      location: validation.data.location,
      notes: validation.data.notes,
    };

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
