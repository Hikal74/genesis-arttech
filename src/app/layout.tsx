import type { Metadata, Viewport } from "next";
import { Ambient } from "@/components/Ambient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Spotlight } from "@/components/Spotlight";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Felt — a diary for how the day felt", template: "%s · Felt" },
  description: "Write about your day, add photographs and a song. Felt develops them into an artistic memory you can return to.",
};

export const viewport: Viewport = { themeColor: "#03080a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
