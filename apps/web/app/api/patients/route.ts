import { createPatientSchema } from "@/lib/validations/patient";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import type { TablesInsert } from "@nascere/supabase/types";
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

    const insertData: TablesInsert<"patients"> = {
      name: validation.data.name,
      email: validation.data.email,
      phone: validation.data.phone,
      street: validation.data.street,
      neighborhood: validation.data.neighborhood,
      complement: validation.data.complement,
      number: validation.data.number,
      city: validation.data.city,
      state: validation.data.state,
      zipcode: validation.data.zipcode,
      created_by: user.id,
    };

    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .insert(insertData)
      .select()
      .single();

    if (patientError) {
      return NextResponse.json({ error: patientError.message }, { status: 500 });
    }

    // Create the pregnancy record
    const { error: pregnancyError } = await supabaseAdmin
      .from("pregnancies")
      .insert({
        patient_id: patient.id,
        due_date: validation.data.due_date,
        observations: validation.data.observations,
      });

    if (pregnancyError) {
      await supabaseAdmin.from("patients").delete().eq("id", patient.id);
      return NextResponse.json({ error: pregnancyError.message }, { status: 500 });
    }

    // Add the creator as a team member
    if (profile.professional_type) {
      const teamMemberData: TablesInsert<"team_members"> = {
        patient_id: patient.id,
        professional_id: user.id,
        professional_type: profile.professional_type,
      };

      const { error: teamError } = await supabaseAdmin.from("team_members").insert(teamMemberData);

      if (teamError) {
        // Rollback patient creation
        await supabaseAdmin.from("patients").delete().eq("id", patient.id);
        return NextResponse.json({ error: teamError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
