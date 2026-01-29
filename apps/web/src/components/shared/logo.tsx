import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
};

const sizes = {
  sm: 48,
  md: 64,
  lg: 96,
  xl: 124,
  "2xl": 160,
  "3xl": 160,
};

export function Logo({ href, size = "md", className }: LogoProps) {
  const image = sizes[size];

  const content = (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt="Doulando"
        width={image}
        height={image}
        className="object-contain"
      />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
