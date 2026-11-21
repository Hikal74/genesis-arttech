import Link from "next/link";
import { Equalizer, Typewriter } from "@/components/Alive";
import { MemoryCard } from "@/components/MemoryCard";
import { Transform } from "@/components/Transform";
import { repo } from "@/lib/server/db";
import { currentOwnerOrNull } from "@/lib/server/owner";
import { getDemoEntries } from "@/lib/server/seed";
import s from "./page.module.css";

const TREATMENTS = [
  ["Film memory", "Faded prints, warm grain, a date burned into the corner.", "days that already feel like the past"],
  ["Editorial", "One strong photograph and a quiet column of type.", "clear, composed days"],
  ["Collage", "Prints taped down, bold type, cuts on the beat.", "crowded, loud, shared days"],
  ["Minimal", "One small image, a lot of air, the slowest motion.", "still days spent alone"],
  ["Abstract signal", "Monochrome frames, a scanning grid, hard cuts.", "pressure and late nights"],
];

const FEATURES = [
  ["/year", "Year in Felt", "Your year as a story: moods, colours of each month, the words and songs you kept coming back to."],
  ["/archive", "Mood calendar", "Every day you wrote, coloured by how it felt. Tap any square to open that day."],
  ["/archive", "Postcards & Stories", "Turn a day into a print-ready postcard or a 9:16 image for your Instagram Story."],
  ["/new", "Speak your day", "Too tired to type? Talk, and your words appear on the page — English, Russian or Kazakh."],
  ["/new", "Felt AI, on your device", "An open AI model that runs in your browser. It suggests titles, songs and prompts — privately."],
  ["/archive", "Private by default", "No account, no profile. Your diary lives behind a key that only your browser holds."],
];

const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function Home() {
  const owner = await currentOwnerOrNull();
  const demos = await getDemoEntries();
  const all = owner ? await repo.list(owner, {}) : [];
  const recent = all.filter((e) => !e.demo).slice(0, 3);
  const preview = recent.length ? recent : all.slice(0, 3);
  const words = demos.flatMap((d) => [...d.analysis.feelings.slice(0, 3), d.analysis.timeOfDay.replace("-", " "), ...d.analysis.motifs.slice(0, 2)]).filter((w) => w && w !== "unknown");
  const swatches = demos.flatMap((d) => d.photos.slice(0, 2).flatMap((p) => p.analysis.palette.slice(0, 3).map((c) => c.hex))).slice(0, 12);
  const sample = demos.find((d) => d.id.startsWith("demo-autumn")) ?? demos[0];
  const prints = demos.slice(0, 3).map((d) => ({ id: d.id, src: d.photos[0]?.media.url, title: d.title, day: d.day }));

  return (
    <main>
      <section className={`wrap ${s.hero}`}>
        <div className={s.heroText}>
          <p className="section-label">a diary for how the day felt</p>
          <h1 className={`display ${s.heroTitle}`}>
            Keep the day, <em>not just the date.</em>
          </h1>
          <p className="lede">
            Write a few lines, add the photos you took and the song that stayed with you. Felt develops them into a small piece of art you can come back to — and a year you can look back on.
          </p>
          <div className={s.ctas}>
            <Link href="/new" className="btn btn-primary">Start your diary</Link>
            {sample && <Link href={`/m/${sample.id}`} className="btn">See an example day</Link>}
          </div>
          <ul className={s.trust}>
            <li>Free</li>
            <li>No sign-up</li>
            <li>AI runs on your device</li>
          </ul>
        </div>
        <div className={s.prints} aria-hidden>
          {prints.map((p, i) => p.src && (
            <Link key={p.id} href={`/m/${p.id}`} className={s.print} data-i={i} tabIndex={-1}>
              <span className={s.tape} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" loading={i === 0 ? "eager" : "lazy"} />
              <span className={s.caption}>{p.title}<small>{fmt(p.day)}</small></span>
            </Link>
          ))}
        </div>
      </section>

      {words.length > 0 && (
        <div className={s.marquee} aria-hidden>
          <div className={s.track}>
            {[...words, ...words, ...words].map((w, i) => <span key={i}>{w}</span>)}
          </div>
        </div>
      )}

      <section className={`wrap ${s.section}`}>
        <div className={s.sectionHead}>
          <p className="section-label">how it works</p>
          <h2 className={`display ${s.h2}`}>Three things from your day. <em>One memory.</em></h2>
        </div>
        <ol className={s.steps}>
          <li className={s.step}>
            <span className={s.stepNum}>01</span>
            <h3>Write the day</h3>
            <p>Who was there, the weather, how heavy it felt. Your words set the light, pace and type.</p>
            <div className={s.demoBox}>
              <Typewriter text={sample ? sample.text.split(". ").slice(0, 2).join(". ") + "." : "We walked through the park after lunch…"} />
            </div>
          </li>
          <li className={s.step}>
            <span className={s.stepNum}>02</span>
            <h3>Add your photos</h3>
            <p>Each photo is read for colour, light and focus — they become the memory’s palette.</p>
            <div className={s.demoBox}>
              <div className={s.swatches}>{swatches.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
            </div>
          </li>
          <li className={s.step}>
            <span className={s.stepNum}>03</span>
            <h3>Pick the song</h3>
            <p>Search for a song, upload a track or let Felt pick one. Its measured tempo and key time every cut and pulse.</p>
            <div className={s.demoBox}>
              <Equalizer bpm={sample?.musicProfile.bpm ?? 96} />
              <span className="meta">{sample ? `${sample.musicProfile.bpm} bpm · ${sample.musicProfile.key ?? sample.musicProfile.mode}` : "tempo · energy · key"}</span>
            </div>
          </li>
        </ol>
      </section>

      <section className={`wrap ${s.section}`}>
        <div className={s.sectionHead}>
          <p className="section-label">watch a day develop</p>
          <h2 className={`display ${s.h2}`}>From a few honest lines <em>to a memory.</em></h2>
        </div>
        <div className={s.demo}>
          <Transform entries={demos.map((e) => ({ ...e, owner: "" }))} />
        </div>
      </section>

      <section className={`wrap ${s.section}`}>
        <div className={s.sectionHead}>
          <p className="section-label">what you get</p>
          <h2 className={`display ${s.h2}`}>More than a page <em>a day.</em></h2>
        </div>
        <div className={s.features}>
          {FEATURES.map(([href, title, text], i) => (
            <Link key={title} href={href} className={s.feature}>
              <span className={s.featureNum}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={`wrap ${s.section} ${s.treatments}`}>
        <div className={s.sectionHead}>
          <p className="section-label">five ways to develop</p>
          <h2 className={`display ${s.h2}`}>No two days <em>look alike.</em></h2>
          <p className="muted">Each memory is scored against five styles, then palette, type, texture and motion are tuned to that exact day.</p>
        </div>
        <ol className={s.treatList}>
          {TREATMENTS.map(([name, text, when], i) => (
            <li key={name} className={s.treat}>
              <span className={s.num}>{i + 1}</span>
              <div>
                <h3>{name}</h3>
                <p>{text}</p>
              </div>
              <span className={s.when}>for {when}</span>
            </li>
          ))}
        </ol>
      </section>

      {preview.length > 0 && (
        <section className={`wrap ${s.section}`}>
          <div className={s.archiveHead}>
            <div className={s.sectionHead}>
              <p className="section-label">{recent.length ? "your diary" : "examples"}</p>
              <h2 className={`display ${s.h2}`}>{recent.length ? "Recently developed" : "Open a memory"}</h2>
            </div>
            <Link href="/archive" className="btn">See every day →</Link>
          </div>
          <div className={s.cards}>
            {preview.map((e) => <MemoryCard key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      <section className="wrap">
        <div className={s.final}>
          <h2 className={`display ${s.h2}`}>How did today <em>feel?</em></h2>
          <p>It takes about two minutes. Your first memory is waiting.</p>
          <Link href="/new" className={`btn ${s.finalBtn}`}>Write today →</Link>
        </div>
      </section>
    </main>
  );
}
