import { createPatientSchema } from "@/lib/validations/patient";
import { createPatient } from "@/services/patient";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Get patients where user is a team member
    const { data: teamMembers, error: teamError } = await supabase
      .from("team_members")
      .select("patient_id")
      .eq("professional_id", user.id);

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    const patientIds = teamMembers?.map((tm) => tm.patient_id) || [];

    if (patientIds.length === 0) {
      return NextResponse.json({ patients: [] });
    }

    const { data: patients, error } = await supabase
      .from("patients")
      .select("*")
      .in("id", patientIds)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patients });
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

    // Verify user is a professional
    const { data: profile } = await supabase
      .from("users")
      .select("user_type, professional_type")
      .eq("id", user.id)
      .single();

    if (profile?.user_type !== "professional") {
      return NextResponse.json(
        { error: "Apenas profissionais podem cadastrar pacientes" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = createPatientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    // Use admin client to bypass RLS for insert operations
    // We've already validated the user is a professional above
    const supabaseAdmin = await createServerSupabaseAdmin();

    try {
      const patient = await createPatient(supabaseAdmin, user.id, validation.data);
      return NextResponse.json({ patient }, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erro ao criar paciente" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
