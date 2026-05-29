import { isStaff } from "@/lib/access-control";
import { getServerAuth, getServerUserEnterprises } from "@/lib/server-auth";
import { AppointmentsScreen } from "@/screens";
import { getMyAppointments } from "@/services/appointment";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export default async function AppointmentsPage() {
  const { profile, user } = await getServerAuth();
  const { appointments } = await getMyAppointments();
  const userIsStaff = isStaff(profile);

  const [googleTokenResult, enterprises] = await Promise.all([
    user
      ? createServerSupabaseAdmin().then((admin) =>
          admin.from("user_google_tokens").select("id").eq("user_id", user.id).maybeSingle(),
        )
      : Promise.resolve({ data: null }),
    userIsStaff ? Promise.resolve([]) : getServerUserEnterprises(),
  ]);

  return (
    <AppointmentsScreen
      appointments={appointments}
      isStaff={userIsStaff}
      isGoogleCalendarConnected={!!googleTokenResult.data}
      enterprises={enterprises}
    />
  );
}
