import { CheckCircle2 } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";

type LandingFeatureBlockProps = {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  image: StaticImageData;
  imageAlt: string;
  reverse?: boolean;
};

export function LandingFeatureBlock({
  id,
  eyebrow,
  title,
  description,
  bullets,
  image,
  imageAlt,
  reverse = false,
}: LandingFeatureBlockProps) {
  return (
    <div
      id={id}
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <div className={cn("flex flex-col gap-4", reverse && "lg:order-2")}>
        <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary text-xs uppercase tracking-wide">
          {eyebrow}
        </span>
        <h3 className="font-poppins font-bold text-2xl leading-tight tracking-tight md:text-[31px]">
          {title}
        </h3>
        <p className="text-[16.5px] text-foreground/65 leading-relaxed">{description}</p>
        {bullets && (
          <ul className="mt-1.5 flex flex-col gap-2.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-[15px] text-foreground/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {bullet}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-[18px] border border-border shadow-[0_18px_40px_-22px_hsl(15_20%_22%/0.3)]",
          reverse && "lg:order-1",
        )}
      >
        <Image src={image} alt={imageAlt} className="block h-full w-full object-cover" />
      </div>
    </div>
  );
}
