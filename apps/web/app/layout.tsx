import type { Metadata, Viewport } from "next";
import { Fraunces, Lato, Poppins } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/providers";

const poppinsSans = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});
const fraunces = Fraunces({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const lato = Lato({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-lato",
});
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Ventre - Gestão de Saúde para Profissionais de Saúde e Gestantes",
  description: "Plataforma de gestão de saúde para profissionais de saúde acompanharem gestantes",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ventre",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Ventre - Gestão de Saúde para Profissionais de Saúde e Gestantes",
    description: "Plataforma de gestão de saúde para profissionais de saúde acompanharem gestantes",
    siteName: "Ventre",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ventre",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ventre - Gestão de Saúde para Profissionais de Saúde e Gestantes",
    description: "Plataforma de gestão de saúde para profissionais de saúde acompanharem gestantes",
    images: ["/images/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#78130A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppinsSans.variable} ${fraunces.variable} ${lato.variable} h-full font-lato antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
