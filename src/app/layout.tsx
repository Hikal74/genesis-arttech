import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Ambient } from "@/components/Ambient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Spotlight } from "@/components/Spotlight";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Felt — a diary for how the day felt", template: "%s · Felt" },
  description: "Write about your day, add photographs and a song. Felt develops them into an artistic memory you can return to.",
};

export const viewport: Viewport = { themeColor: "#03080a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <body className="grain">
        <Ambient />
        <Spotlight />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
