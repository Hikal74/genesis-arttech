import type { MoodCount } from "../analysis/mood.ts";
import type { TextAnalysis } from "../types.ts";

export type FaceKey = "grotesk" | "serif" | "mono" | "hand" | "expressive";

export interface Face {
  key: FaceKey;
  family: string;
  label: string;
  reason: string;
  scale: number;
  weight: number;
  italic: boolean;
}

const FACES: Record<FaceKey, Omit<Face, "reason">> = {
  grotesk: { key: "grotesk", family: "var(--font-sans)", label: "grotesk", scale: 1, weight: 500, italic: false },
  serif: { key: "serif", family: "var(--font-serif)", label: "serif", scale: 1.08, weight: 400, italic: false },
  mono: { key: "mono", family: "var(--font-mono)", label: "mono", scale: 0.92, weight: 400, italic: false },
  hand: { key: "hand", family: "var(--font-hand)", label: "handwriting", scale: 1.4, weight: 500, italic: false },
  expressive: { key: "expressive", family: "var(--font-expressive)", label: "expressive", scale: 1.04, weight: 600, italic: false },
};

export function faceFor(mood: MoodCount, a: TextAnalysis | null): Face {
  const pick = (key: FaceKey, reason: string): Face => ({ ...FACES[key], reason });
  if (!mood.hits.length && !a) return pick("grotesk", "waiting for your words");

  const techy = a ? a.motifs.some((m) => m === "Code" || m === "Deadline" || m === "Screens") : false;
  if ((a && a.tension > 0.5) || (techy && mood.balance < 0.3)) return pick("mono", "focused — a typewriter for pressure");
  if (mood.mood === "low" || mood.mood === "stormy") return pick("hand", "heavy days feel more personal by hand");
  if (mood.mood === "radiant" || (mood.mood === "bright" && (a?.arousal ?? 0) > 0.55)) return pick("expressive", "loud and bright — the letters get bolder");
  if ((a && a.nostalgia > 0.35) || mood.mood === "calm" || (a && a.arousal < 0.4 && a.warmth > 0.55)) return pick("serif", "slow and wistful — a softer serif");
  return pick("grotesk", mood.mood === "mixed" ? "two colours at once — a plain, steady face" : "clear and even");
}
