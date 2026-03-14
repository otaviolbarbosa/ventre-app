import { updatePatientSchema } from "@/lib/validations/patient";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import { NextResponse } from "next/server";

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

    const { data: patient, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patient });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updatePatientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const { data: patient, error } = await supabase
      .from("patients")
      .update({
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
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update pregnancy fields if provided
    if (validation.data.due_date || validation.data.observations !== undefined) {
      const pregnancyUpdate: { due_date?: string; observations?: string } = {};
      if (validation.data.due_date) pregnancyUpdate.due_date = validation.data.due_date;
      if (validation.data.observations !== undefined) pregnancyUpdate.observations = validation.data.observations;

      await supabase
        .from("pregnancies")
        .update(pregnancyUpdate)
        .eq("patient_id", id);
    }

    return NextResponse.json({ patient });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verify user is the creator
    const { data: patient } = await supabase
      .from("patients")
      .select("created_by")
      .eq("id", id)
      .single();

    if (patient?.created_by !== user.id) {
      return NextResponse.json(
        { error: "Apenas o criador pode excluir o paciente" },
        { status: 403 },
      );
    }

    const { error } = await supabase.from("patients").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
