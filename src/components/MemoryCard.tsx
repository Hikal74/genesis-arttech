import Link from "next/link";
import type { EntrySummary } from "@/lib/types";
import { formatDay, TREATMENT_LABEL } from "@/lib/theme";
import { Photo } from "./Photo";
import { Waveform } from "./Waveform";
import s from "./MemoryCard.module.css";

export function MemoryCard({ entry, priority = false }: { entry: EntrySummary; priority?: boolean }) {
  const p = entry.palette;
  const t = entry.type;
  const family = t.family === "serif" ? "var(--font-serif)" : t.family === "mono" ? "var(--font-mono)" : "var(--font-sans)";
  return (
    <Link
      href={`/m/${entry.id}`}
      className={`${s.card} ${s[entry.treatment]}`}
      style={{ "--c-ground": p.ground, "--c-ink": p.ink, "--c-muted": p.muted, "--c-accent": p.accent, "--c-accent2": p.accent2, "--c-glow": p.glow } as React.CSSProperties}
    >
      <div className={s.plate}>
        {entry.cover ? (
          <Photo src={entry.cover} alt="" width={1400} height={1050} sizes="(max-width: 760px) 92vw, 400px" className={s.photo} priority={priority} />
        ) : (
          <div className={s.photo} />
        )}
        <span className={s.light} aria-hidden />
        <div className={s.swatches} aria-hidden>
          {p.swatches.slice(0, 5).map((c, i) => <i key={i} style={{ background: c }} />)}
        </div>
      </div>
      <div className={s.body}>
        <div className={s.row}>
          <span className={s.meta}>{formatDay(entry.day, "short")}</span>
          {entry.demo ? <span className={s.demo}>Demo</span> : <span className={s.meta}>{TREATMENT_LABEL[entry.treatment]}</span>}
        </div>
        <h3
          className={s.title}
          style={{
            fontFamily: family,
            fontStyle: t.italic ? "italic" : "normal",
            fontWeight: t.family === "serif" ? 400 : t.weight,
            fontVariationSettings: t.family === "grotesk" ? `"wdth" ${t.width}` : undefined,
            textTransform: t.uppercase ? "uppercase" : "none",
            letterSpacing: `${t.tracking}em`,
          }}
        >
          {entry.title}
        </h3>
        <p className={s.atmos}>{entry.atmosphere}</p>
        <div className={s.foot}>
          <Waveform envelope={entry.envelope} color={p.accent} height={22} />
          <span className={s.meta}>{entry.bpm}&nbsp;bpm</span>
        </div>
      </div>
    </Link>
  );
}
