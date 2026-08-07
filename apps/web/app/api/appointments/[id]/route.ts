import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { createServerSupabaseClient } from "@ventre/supabase/server";
import type { TablesUpdate } from "@ventre/supabase/types";
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

    // Capture pre-update date/time so we can tell a real reschedule apart from a
    // field-only edit (notes, location, duration) before sending WhatsApp.
    const { data: previousAppointment } = await supabase
      .from("appointments")
      .select("date, time")
      .eq("id", id)
      .single();

    const { data: appointment, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .select("*, patient:patients(id, name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget: send notification
    if (appointment?.patient) {
      const isCancelled = validation.data.status === "cancelada";
      const notificationType = isCancelled ? "appointment_cancelled" : "appointment_updated";
      const patient = appointment.patient as { id: string; name: string };
      const template = getNotificationTemplate(notificationType, {
        patientName: patient.name,
        date: appointment.date,
        time: appointment.time,
      });
      sendNotificationToTeam(patient.id, user.id, {
        type: notificationType,
        ...template,
        data: { url: "/appointments" },
      });

      // WhatsApp goes to the patient's personal phone (Meta bills per conversation and
      // penalizes low-relevance sends), so only fire appointment_updated when the date
      // or time actually changed — not on every notes/location/duration edit.
      const isReschedule =
        previousAppointment != null &&
        (previousAppointment.date !== appointment.date ||
          previousAppointment.time !== appointment.time);

      if (isCancelled || isReschedule) {
        sendWhatsAppToUser(
          { recipientType: "patient", recipientId: patient.id },
          isCancelled ? "appointment_cancelled" : "appointment_updated",
          { patientName: patient.name, date: appointment.date, time: appointment.time },
        ).catch((err) => {
          console.error("[whatsapp] appointment update/cancel send failed", err);
        });
      }
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
