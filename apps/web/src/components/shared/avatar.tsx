import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils";
import Image from "next/image";
import type { HTMLAttributes } from "react";

type AvatarProps = {
  size?: number;
  className?: HTMLAttributes<HTMLDivElement>["className"];
};

export default function Avatar({ size = 9, className }: AvatarProps) {
  const { profile } = useAuth();

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden overflow-hidden rounded-full rounded-full border bg-primary-100 font-semibold text-primary-700",
        `size-${size}`,
        className,
      )}
    >
      {profile?.avatar_url ? (
        <Image
          src={profile.avatar_url}
          className={cn(`size-${size}`)}
          alt="User avatar"
          width={36}
          height={36}
          priority
        />
      ) : (
        getInitials(profile?.name)
      )}
    </div>
  );
}
