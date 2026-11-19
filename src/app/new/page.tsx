import type { Metadata } from "next";
import { Composer } from "@/components/Composer";
import { appConfig } from "@/lib/server/config";

export const metadata: Metadata = { title: "A new day" };
export const dynamic = "force-dynamic";

export default function NewPage() {
  return (
    <main className="wrap" style={{ paddingTop: "var(--s-7)", paddingBottom: "var(--s-10)" }}>
      <header style={{ marginBottom: "var(--s-8)", maxWidth: 900 }}>
        <h1 className="display" style={{ fontSize: "var(--t-1)" }}>
          How did today <em>feel?</em>
        </h1>
        <p className="lede" style={{ marginTop: "var(--s-5)" }}>
          Write it down, add the photographs you took and the song that stayed with you. Felt reads all three and develops them into one memory.
        </p>
      </header>
      <Composer config={appConfig()} />
    </main>
  );
}
