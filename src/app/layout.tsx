import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Felt — a diary for how the day felt", template: "%s · Felt" },
  description: "Write about your day, add photographs and a song. Felt develops them into an artistic memory you can return to.",
};

export const viewport: Viewport = { themeColor: "#0c0b0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${archivo.variable} ${jetbrains.variable}`}>
      <body className="grain">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
