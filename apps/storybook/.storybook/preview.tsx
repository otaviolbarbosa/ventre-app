import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";
import { Toaster } from "@ventre/ui/sonner";
import { TooltipProvider } from "@ventre/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { INITIAL_VIEWPORTS } from "storybook/viewport";

import type { Preview } from "@storybook/nextjs";

import "../src/styles/globals.css";

/**
 * Breakpoints do próprio projeto (padrão Tailwind + o limite de 640px que
 * ConfirmModal/ContentModal usam via `window.innerWidth`/`matchMedia` para
 * alternar entre Dialog e Sheet). Ficam no topo do seletor de viewport,
 * antes do catálogo genérico de dispositivos do Storybook.
 */
const projectViewports = {
  mobile: {
    name: "Mobile (< 640px)",
    styles: { width: "375px", height: "812px" },
    type: "mobile" as const,
  },
  tablet: {
    name: "Tablet (768px)",
    styles: { width: "768px", height: "1024px" },
    type: "tablet" as const,
  },
  desktop: {
    name: "Desktop (1280px)",
    styles: { width: "1280px", height: "800px" },
    type: "desktop" as const,
  },
  wide: {
    name: "Wide (1536px)",
    styles: { width: "1536px", height: "900px" },
    type: "desktop" as const,
  },
};

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      options: { ...projectViewports, ...INITIAL_VIEWPORTS },
    },
  },
  globalTypes: {
    theme: {
      description: "Tema global dos componentes",
      toolbar: {
        title: "Tema",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Claro" },
          { value: "dark", icon: "moon", title: "Escuro" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === "dark" ? "dark" : "light";

      return (
        <ThemeProvider attribute="class" forcedTheme={theme} enableSystem={false}>
          <TooltipProvider>
            <ConfirmationModalProvider>
              <div className={theme}>
                <div className="min-h-[4rem] min-w-[16rem] bg-background p-6 text-foreground">
                  <Story />
                </div>
              </div>
              <Toaster />
            </ConfirmationModalProvider>
          </TooltipProvider>
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
