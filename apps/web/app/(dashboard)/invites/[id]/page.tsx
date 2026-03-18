import { getServerUser } from "@/lib/server-auth";
import InviteDetailsScreen from "@/screens/invite-details-screen";
import { getPendingInviteById } from "@/services/invite";

export default async function InviteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getServerUser();
  let selfInvite = false;

  const { data: invite } = await getPendingInviteById(id);

  if (invite?.inviter?.id === user?.id) {
    selfInvite = true;
  }

  return <InviteDetailsScreen invite={selfInvite ? undefined : invite} />;
}
