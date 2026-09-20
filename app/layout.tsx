import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "S&S Burger — Pide en línea",
    template: "%s · S&S Burger",
  },
  description:
    "Hamburguesas, perros calientes y salchipapas. Pide en línea para recoger o a domicilio.",
  openGraph: {
    title: "S&S Burger",
    description: "Pide en línea para recoger o a domicilio.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c2d12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
