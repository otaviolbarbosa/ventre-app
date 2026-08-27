import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Shared between contract-pdf-document.tsx and contract-certificate-document.tsx —
// both get rendered in the same PDF-generation pass, so registering once here avoids
// two independent Font.register("Inter", ...) calls racing/duplicating on import.
export const PDF_FONT_FAMILY = "Inter";
export const PDF_FONT_FAMILY_POPPINS = "Poppins";
export const PDF_FONT_FAMILY_LATO = "Lato";

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

Font.register({
  family: PDF_FONT_FAMILY_POPPINS,
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/Poppins-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/Poppins-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

Font.register({
  family: PDF_FONT_FAMILY_LATO,
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/Lato-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/Lato-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});
