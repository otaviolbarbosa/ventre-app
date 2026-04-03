"use client";
import { Avatar, AvatarFallback, AvatarImage } from "../../avatar";
import { cn } from "../../utils/utils";

type User = { name: string; avatar_url?: string | null };

type UserAvatarProps = {
  user: User;
  size?: number;
  className?: string;
};

const getInitials = (name?: string | null) => {
  const names = name
    ?.replace(/[^\p{L}\s]/gu, "")
    .split(" ")
    .filter(Boolean);

  if (!names || names.length === 0) return "?";

  return names.length === 1
    ? (names[0]?.charAt(0).toUpperCase() ?? "?")
    : `${names[0]?.charAt(0)}${names[names.length - 1]?.charAt(0)}`.toUpperCase();
};

export function UserAvatar({ user, size = 8, className }: UserAvatarProps) {
  return (
    <Avatar className={cn(`w-${size}`, `h-${size}`, "bg-white shadow-sm", className)}>
      <AvatarImage
        src={user.avatar_url ?? undefined}
        alt={user.name}
        className="rounded-full object-cover"
      />
      <AvatarFallback
        className={cn(
          "flex items-center justify-center font-poppins font-semibold text-primary",
          size >= 10 && "text-lg",
        )}
      >
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
