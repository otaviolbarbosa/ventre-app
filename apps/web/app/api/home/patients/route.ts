import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const search = searchParams.get("search") || "";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("patient_id")
      .eq("professional_id", user.id);

    const patientIds = teamMembers?.map((tm) => tm.patient_id) || [];

    if (patientIds.length === 0) {
      return NextResponse.json({ patients: [] });
    }

    let query = supabase.from("patients").select("*").in("id", patientIds);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (filter === "all") {
      query = query.order("updated_at", { ascending: false });
    } else if (filter === "recent") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order("due_date", { ascending: true });
    }

    const { data: patients, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const today = dayjs();

    const patientsWithInfo = (patients || [])
      .map((patient) => {
        const gestationalAge = calculateGestationalAge(patient.dum);
        const dueDate = dayjs(patient.due_date);
        const remainingDays = dueDate.diff(today, "day");

        return {
          ...patient,
          weeks: gestationalAge?.weeks ?? 0,
          days: gestationalAge?.days ?? 0,
          remainingDays: Math.max(remainingDays, 0),
          progress: gestationalAge
            ? Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100)
            : 0,
        };
      })
      .filter((p) => {
        if (filter === "final") return p.weeks >= 28;
        return true;
      })
      .slice(0, 5);

    return NextResponse.json({ patients: patientsWithInfo });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
