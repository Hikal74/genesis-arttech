import type { Metadata } from "next";
import { MoodCalendar } from "@/components/MoodCalendar";
import { YearStory } from "@/components/YearStory";
import { repo } from "@/lib/server/db";
import { currentOwnerOrNull } from "@/lib/server/owner";
import { ensureDemos } from "@/lib/server/seed";
import { yearStats } from "@/lib/year";

export const metadata: Metadata = { title: "Your year in Felt" };

export default async function YearPage({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const owner = await currentOwnerOrNull();
  await ensureDemos();
  const entries = owner ? await repo.list(owner, {}) : [];
  const own = entries.filter((e) => !e.demo);
  const years = [...new Set(own.map((e) => Number(e.day.slice(0, 4))))].sort((a, b) => b - a);
  const asked = Number((await searchParams).y);
  const year = years.includes(asked) ? asked : years[0] ?? new Date().getFullYear();
  const stats = yearStats(entries, year);

  return (
    <main className="wrap" style={{ paddingTop: "var(--s-7)", paddingBottom: "var(--s-9)" }}>
      <header style={{ marginBottom: "var(--s-6)" }}>
        <p className="meta section-label" style={{ marginBottom: "var(--s-4)" }}>year in felt</p>
        <h1 className="display" style={{ fontSize: "clamp(2.4rem, 5.6vw, 4.6rem)" }}>
          {year}, <em>felt.</em>
        </h1>
      </header>
      <YearStory stats={stats} years={years} />
      <section style={{ marginTop: "var(--s-9)" }}>
        <p className="meta section-label" style={{ marginBottom: "var(--s-5)" }}>mood calendar</p>
        <MoodCalendar entries={(stats.demo ? entries.filter((e) => e.demo) : own).map(({ id, day, title, mood }) => ({ id, day, title, mood }))} year={Number((stats.firstDay ?? String(year)).slice(0, 4))} />
      </section>
    </main>
  );
}
