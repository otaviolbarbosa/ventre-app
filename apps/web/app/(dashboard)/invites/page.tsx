"use server";
import InvitesScreen from "@/screens/invites-screen";
import { getReceivedInvites, getSentPatientInvites, getSentTeamInvites } from "@/services/invite";

export default async function InvitesPage() {
  const [received, sentTeam, sentPatient] = await Promise.all([
    getReceivedInvites(),
    getSentTeamInvites(),
    getSentPatientInvites(),
  ]);

  return (
    <InvitesScreen
      received={received.data ?? { active: [], inactive: [] }}
      sentTeam={sentTeam.data ?? { active: [], inactive: [] }}
      sentPatient={sentPatient.data ?? { active: [], inactive: [] }}
    />
  );
}
