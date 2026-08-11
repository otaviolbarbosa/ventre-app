"use client";

import { cn } from "@/lib/utils";
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
      className={cn(
        "grid gap-0.5 rounded-[1rem] transition-opacity",
        teamMembers.length === 1
          ? "grid-cols-1"
          : teamMembers.length === 2
            ? "grid-cols-2"
            : "grid-cols-3",
      )}
    >
      {teamMembers.map((teamMember) => (
        <div key={teamMember.id} className={"rounded-full border border-white"}>
          <Avatar size={5} src={teamMember.professional?.avatar_url ?? ""} name={""} />
        </div>
      ))}
    </button>
  );
}
