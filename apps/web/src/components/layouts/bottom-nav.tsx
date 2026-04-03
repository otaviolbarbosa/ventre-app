"use client";
import { getPendingInvitesAction } from "@/actions/get-pending-invites-action";
import { isStaff } from "@/lib/access-control";
import { cn } from "@/lib/utils";
import {
  BriefcaseMedicalIcon,
  Calendar,
  CircleDollarSign,
  Ellipsis,
  Home,
  type LucideProps,
  Mail,
  Users,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ForwardRefExoticComponent,
  type RefAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../providers/auth-provider";
import Avatar from "../shared/avatar";

type MainNavProps = {
  name: string;
  href: string;
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  isActive: boolean;
  hasNewContent?: boolean;
}[];

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const { profile } = useAuth();

  const { execute, result } = useAction(getPendingInvitesAction);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    execute();
  }, []);

  const hasPendingInvites = result.data?.hasPendingInvites ?? false;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const handleMoreToggle = useCallback(() => {
    setMoreOpen((prev) => !prev);
  }, []);

  if (pathname === "/onboarding") {
    return null;
  }

  const isProfileActive = pathname.startsWith("/profile");

  const mainNav: MainNavProps = isStaff(profile)
    ? [
        { name: "Início", href: "/home", icon: Home, isActive: pathname.startsWith("/home") },
        {
          name: "Colaboradoras",
          href: "/users",
          icon: BriefcaseMedicalIcon,
          isActive: pathname.startsWith("/users"),
        },

        {
          name: "Gestantes",
          href: "/patients",
          icon: Users,
          // icon: (props: React.SVGProps<SVGSVGElement>) => <CustomIcon icon="pregnant" {...props} />,
          isActive: pathname.startsWith("/patients"),
        },
        {
          name: "Agenda",
          href: "/appointments",
          icon: Calendar,
          isActive: pathname.startsWith("/appointments"),
        },
      ]
    : [
        { name: "Início", href: "/home", icon: Home, isActive: pathname.startsWith("/home") },
        {
          name: "Gestantes",
          href: "/patients",
          icon: Users,
          isActive: pathname.startsWith("/patients"),
        },
        {
          name: "Agenda",
          href: "/appointments",
          icon: Calendar,
          isActive: pathname.startsWith("/appointments"),
        },
        {
          name: "Convites",
          href: "/invites",
          icon: Mail,
          isActive: pathname.startsWith("/invites"),
          hasNewContent: hasPendingInvites,
        },
      ];

  const overflowNav = isStaff(profile)
    ? [
        {
          name: "Financeiro",
          href: "/billing",
          icon: CircleDollarSign,
          isActive: pathname.startsWith("/billing"),
        },
      ]
    : [
        {
          name: "Financeiro",
          href: "/billing",
          icon: CircleDollarSign,
          isActive: pathname.startsWith("/billing"),
        },
      ];

  const isOverflowActive = overflowNav.some((item) => item.isActive) || isProfileActive;

  return (
    <div className="fixed bottom-0 z-50 w-full px-2 py-4 sm:hidden">
      <div ref={moreRef} className="relative">
        <div
          className={cn(
            "-mr-1.5 absolute right-2 bottom-full mb-2 flex flex-col gap-1.5 rounded-[2rem] border border-white bg-primary/10 p-2.5 shadow-md shadow-primary/10 backdrop-blur-md transition-opacity duration-300",
            moreOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {overflowNav.map((navItem) => (
            <Link
              key={`overflow-nav-${navItem.name}`}
              href={navItem.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "relative flex h-11 items-center gap-2 rounded-full border border-primary/20 bg-white px-3",
                "transition-all duration-500 ease-out",
                navItem.isActive && "gradient-primary shadow-md",
              )}
              prefetch
            >
              <navItem.icon
                className={cn(
                  "size-5 text-primary transition-colors duration-500 ease-out",
                  navItem.isActive && "text-white",
                )}
              />
              <span
                className={cn(
                  "min-w-[90px] text-center font-medium font-poppins text-primary text-xs",
                  navItem.isActive && "text-white",
                )}
              >
                {navItem.name}
              </span>
            </Link>
          ))}
          <Link
            href="/profile"
            onClick={() => setMoreOpen(false)}
            className={cn(
              "relative flex h-11 items-center gap-1 rounded-full border border-primary/20 bg-white px-1",
              "transition-all duration-500 ease-out",
              isProfileActive && "gradient-primary shadow-md",
            )}
          >
            <Avatar
              src={profile?.avatar_url ?? ""}
              name={profile?.name ?? ""}
              size={8}
              className="border-none"
            />
            <span
              className={cn(
                "flex-1 text-center font-medium font-poppins text-primary text-xs",
                isProfileActive && "text-white",
              )}
            >
              Perfil
            </span>
          </Link>
        </div>

        <div className="flex justify-between gap-1 overflow-scroll rounded-full border border-white bg-primary/10 p-1.5 shadow-md shadow-primary/10 backdrop-blur-md">
          {mainNav.map((navItem) => (
            <Link
              key={`bottom-nav-${navItem.name}`}
              href={navItem.href}
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
                "transition-all duration-500 ease-out",
                navItem.isActive &&
                  "gradient-primary size-auto flex-1 justify-between px-4 opacity-100 shadow-md",
              )}
              prefetch
            >
              <navItem.icon
                className={cn(
                  "size-5 text-primary transition-colors duration-500 ease-out",
                  navItem.isActive && "text-white",
                )}
              />

              <div
                className={cn(
                  "flex-1 overflow-hidden text-center font-medium font-poppins text-white text-xs transition-all duration-500 ease-out",
                  navItem.isActive ? "opacity-100" : "max-w-0 opacity-0",
                )}
              >
                {navItem.name}
              </div>
              {!navItem.isActive && navItem.hasNewContent && (
                <div className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </Link>
          ))}
          {isStaff(profile) && overflowNav.length === 0 ? (
            <Link
              href="/profile"
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
                "transition-all duration-500 ease-out",
                pathname.startsWith("/profile") &&
                  "gradient-primary size-auto flex-1 pr-4 pl-1 opacity-100 shadow-md",
              )}
              prefetch
            >
              <Avatar src={profile?.avatar_url ?? ""} size={10} name={profile?.name ?? ""} />
              <div
                className={cn(
                  "flex-1 overflow-hidden text-center font-medium font-poppins text-white text-xs transition-all duration-500 ease-out",
                  pathname.startsWith("/profile") ? "opacity-100" : "max-w-0 opacity-0",
                )}
              >
                Perfil
              </div>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleMoreToggle}
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
                "transition-all duration-500 ease-out",
                isOverflowActive && "gradient-primary shadow-md",
              )}
            >
              <Ellipsis
                className={cn(
                  "size-5 text-primary transition-colors duration-500 ease-out",
                  isOverflowActive && "text-white",
                )}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
