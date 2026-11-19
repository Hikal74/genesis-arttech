import Link from "next/link";
import { MemoryCard } from "@/components/MemoryCard";
import { Transform } from "@/components/Transform";
import { repo } from "@/lib/server/db";
import { currentOwnerOrNull } from "@/lib/server/owner";
import { DEMO_OWNER } from "@/lib/server/owner-token";
import { ensureDemos } from "@/lib/server/seed";
import type { Entry } from "@/lib/types";
import s from "./page.module.css";

const TREATMENTS = [
  ["Film memory", "For days that already feel like the past: faded prints, warm grain, a date burned into the corner, slow dissolves."],
  ["Editorial", "For clear, composed days: one strong photograph, a quiet column of type, generous space."],
  ["Collage", "For crowded, loud, shared days: prints scattered and taped down, wide type, cuts on the beat."],
  ["Minimal", "For still days spent alone: one small image, a lot of air, the slowest motion."],
  ["Abstract signal", "For pressure and late nights: monochrome photographs, a scanning grid, timecode, hard cuts."],
];

export default async function Home() {
  const owner = await currentOwnerOrNull();
  await ensureDemos();
  const all = owner ? await repo.list(owner, {}) : [];
  const demos = (await Promise.all(all.filter((e) => e.demo).map((e) => repo.get(DEMO_OWNER, e.id)))).filter((e): e is Entry => Boolean(e));
  const recent = all.filter((e) => !e.demo).slice(0, 3);
  const preview = recent.length ? recent : all.slice(0, 3);

  return (
    <main>
      <section className={`wrap ${s.hero}`}>
        <div className={s.heroText}>
          <p className="meta">A diary for Genesis ArtTech 2026 · Make the invisible visible</p>
          <h1 className={`display ${s.heroTitle}`}>
            People remember how a day <em>felt.</em>
          </h1>
          <p className="lede">
            Write what happened. Add the photographs you took and the song that stayed with you. Felt reads all three and develops them into a memory with its own light, colour and rhythm — kept in a private archive you can return to.
          </p>
          <div className={s.ctas}>
            <Link href="/new" className="btn btn-primary">Write today</Link>
            <Link href="/archive" className="btn">Open the archive</Link>
          </div>
        </div>
        <div className={s.heroDemo}>
          <Transform entries={demos.map((e) => ({ ...e, owner: "" }))} />
        </div>
      </section>

      <section className={`wrap ${s.inputs}`}>
        <h2 className={`display ${s.h2} reveal`}>Three inputs.<br /><em>One atmosphere.</em></h2>
        <div className={s.cols}>
          <article className="reveal">
            <span className={s.num}>01 — Words</span>
            <h3>The entry sets the light.</h3>
            <p>Time of day, season, weather, who was there and how much it weighed. Nostalgia fades and warms the photographs; pressure drains them toward monochrome; a shared, loud day pushes the colour.</p>
          </article>
          <article className="reveal">
            <span className={s.num}>02 — Photographs</span>
            <h3>The pictures give the colour.</h3>
            <p>Every photograph is read pixel by pixel: its palette, brightness, contrast, warmth and where its visual weight sits. The memory’s palette is developed from those colours, then shifted by mood.</p>
          </article>
          <article className="reveal">
            <span className={s.num}>03 — Music</span>
            <h3>The song sets the pace.</h3>
            <p>Uploaded tracks are analysed for tempo, energy, brightness and key. The beat times every cut and pulse; a minor key holds the colours close, a bright major one sets them against each other.</p>
          </article>
        </div>
      </section>

      <section className={`wrap ${s.treatments}`}>
        <div className={s.treatHead}>
          <p className="meta">The visual system</p>
          <h2 className={`display ${s.h2}`}>Five ways a day can develop.</h2>
          <p className="muted">No templates are picked at random. Each memory scores every treatment against its inputs, then sets palette, type, texture, light and motion continuously — so no two days come out the same.</p>
        </div>
        <ol className={s.treatList}>
          {TREATMENTS.map(([name, text], i) => (
            <li key={name} className="reveal">
              <span className={s.num}>0{i + 1}</span>
              <h3>{name}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {preview.length > 0 && (
        <section className={`wrap ${s.archive}`}>
          <div className={s.archiveHead}>
            <h2 className={`display ${s.h2}`}>{recent.length ? "Recently developed" : "From the archive"}</h2>
            <Link href="/archive" className="btn">See every day</Link>
          </div>
          <div className={s.cards}>
            {preview.map((e) => <MemoryCard key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      <section className={`wrap ${s.principles}`}>
        <div>
          <h3>Private by default</h3>
          <p>Each browser gets its own diary key. Entries, photographs and audio are stored privately and only served back to that key.</p>
        </div>
        <div>
          <h3>Explainable</h3>
          <p>Every memory shows how it was made: which words, colours and beats led to which visual decisions.</p>
        </div>
        <div>
          <h3>Atmosphere, not diagnosis</h3>
          <p>Felt reads mood for art direction only. It never assesses anyone’s mental or emotional health.</p>
        </div>
        <div>
          <h3>Your music, played properly</h3>
          <p>Upload a track you own, or link Spotify, YouTube, SoundCloud or Apple Music through their official players.</p>
        </div>
      </section>
    </main>
  );
}
