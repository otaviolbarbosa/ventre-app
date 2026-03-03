import Google from "@/assets/custom-icons/google";
import Pregnant from "@/assets/custom-icons/pregnant";
import PregnantIcon from "@/assets/custom-icons/pregnant-icon";
import Whatsapp from "@/assets/custom-icons/whatsapp";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
export type CustomIconName = "google" | "pregnant-icon" | "pregnant" | "whatsapp";

const customIcons: Record<CustomIconName, React.ComponentType<IconProps>> = {
  google: Google,
  "pregnant-icon": PregnantIcon,
  pregnant: Pregnant,
  whatsapp: Whatsapp,
};

type CustomIconProps = IconProps & {
  icon: CustomIconName;
};

export default function CustomIcon({ icon, ...props }: CustomIconProps) {
  const Icon = customIcons[icon];
  return <Icon {...props} />;
}
