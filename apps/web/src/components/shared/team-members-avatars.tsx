"use client";

import type { TeamMember } from "@/types";
import { useRouter } from "next/navigation";
import Avatar from "./avatar";

type TeamMembersAvatarsProps = { teamMembers: TeamMember[]; patientId: string };

export default function TeamMembersAvatars({ teamMembers, patientId }: TeamMembersAvatarsProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/patients/${patientId}/team`);
      }}
      title="Ver equipe"
      className="flex flex-row-reverse rounded-full bg-primary/10 p-0.5 pl-2 transition-opacity hover:opacity-80"
    >
      {teamMembers.map((teamMember) => (
        <div key={teamMember.id} className={"-ml-1.5 z-10 rounded-full border border-white"}>
          <Avatar size={5} src={teamMember.professional?.avatar_url ?? ""} name={""} />
        </div>
      ))}
    </button>
  );
}
