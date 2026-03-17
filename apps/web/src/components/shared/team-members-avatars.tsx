import type { TeamMember } from "@/types";
import Avatar from "./avatar";

type TeamMembersAvatarsProps = { teamMembers: TeamMember[] };

export default function TeamMembersAvatars({ teamMembers }: TeamMembersAvatarsProps) {
  return (
    <div className="flex">
      {teamMembers.map((teamMember, index) => (
        <div
          key={teamMember.id}
          className={`-ml-1.5 rounded-full border border-white z-${50 - 10 * index}`}
        >
          <Avatar size={5} src={teamMember.professional?.avatar_url ?? ""} name={""} />
        </div>
      ))}
    </div>
  );
}
