import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Shared between contract-pdf-document.tsx and contract-certificate-document.tsx —
// both get rendered in the same PDF-generation pass, so registering once here avoids
// two independent Font.register("Inter", ...) calls racing/duplicating on import.
export const PDF_FONT_FAMILY = "Inter";

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});
