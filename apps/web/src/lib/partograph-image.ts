// Server-only module: imports sharp. Never import from client components.
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { buildPartographOverlaySvg } from "@/lib/partograph-overlay-svg";
import sharp from "sharp";

const TEMPLATE_PATH = path.join(process.cwd(), "src/assets/partograph-template.png");
const LATO_FONT_PATH = path.join(process.cwd(), "public/fonts/Lato-Regular.ttf");

// sharp's SVG rasterizer (librsvg) resolves text glyphs through the OS's fontconfig setup,
// which the Vercel serverless runtime doesn't have — text silently renders as blank/tofu
// boxes there even though it looks fine locally. resvg embeds the font file directly, so
// glyph lookup never depends on what's installed on the host.
export async function renderPartographImageBuffer(
  events: BirthModeTimelineEvent[],
): Promise<Buffer> {
  const svg = buildPartographOverlaySvg(events);
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: [LATO_FONT_PATH],
      loadSystemFonts: false,
      defaultFontFamily: "Lato",
    },
  });
  const rasterizedOverlay = resvg.render().asPng();

  return sharp(TEMPLATE_PATH)
    .composite([{ input: rasterizedOverlay }])
    .png()
    .toBuffer();
}
