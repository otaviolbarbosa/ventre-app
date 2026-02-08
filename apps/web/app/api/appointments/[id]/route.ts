import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import type { TablesUpdate } from "@nascere/supabase/types";

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

    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("*, professional:users!appointments_professional_id_fkey(name, professional_type)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointment });
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
    const validation = updateAppointmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const updateData: TablesUpdate<"appointments"> = {
      date: validation.data.date,
      time: validation.data.time,
      duration: validation.data.duration,
      type: validation.data.type,
      status: validation.data.status,
      location: validation.data.location,
      notes: validation.data.notes,
    };

    const { data: appointment, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .select("*, patient:patients!appointments_patient_id_fkey(id, name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget: send notification
    if (appointment?.patient) {
      const isCancelled = validation.data.status === "cancelada";
      const notificationType = isCancelled ? "appointment_cancelled" : "appointment_updated";
      const template = getNotificationTemplate(notificationType, {
        patientName: (appointment.patient as { name: string }).name,
        date: appointment.date,
        time: appointment.time,
      });
      sendNotificationToTeam(
        (appointment.patient as { id: string }).id,
        user.id,
        {
          type: notificationType,
          ...template,
          data: { url: "/appointments" },
        },
      );
    }

    return NextResponse.json({ appointment });
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

    const { error } = await supabase.from("appointments").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
