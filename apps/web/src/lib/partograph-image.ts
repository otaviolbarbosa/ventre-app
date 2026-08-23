// Server-only module: imports sharp. Never import from client components.
import path from "node:path";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { buildPartographOverlaySvg } from "@/lib/partograph-overlay-svg";
import sharp from "sharp";

const TEMPLATE_PATH = path.join(process.cwd(), "src/assets/partograph-template.png");

export async function renderPartographImageBuffer(
  events: BirthModeTimelineEvent[],
): Promise<Buffer> {
  const svg = buildPartographOverlaySvg(events);
  return sharp(TEMPLATE_PATH)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}
