"use client";

import bgFingerprint from "@/assets/bg-fingerprint.png";
import { usePathname } from "next/navigation";

export function DashboardBackground() {
  const pathname = usePathname();

  if (pathname !== "/home") return null;

  return (
    <div
      className="-z-10 pointer-events-none absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage: `url(${bgFingerprint.src})`,
        backgroundRepeat: "repeat",
        backgroundSize: "3200px",
        backgroundPositionX: "-100px",
        backgroundPositionY: "-200px",
      }}
    />
  );
}
