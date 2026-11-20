import type { DayMood } from "./types";

export const MOODS: { key: DayMood; label: string; color: string; line: string }[] = [
  { key: "radiant", label: "Radiant", color: "#FFD83D", line: "days that glowed" },
  { key: "bright", label: "Bright", color: "#F7A94B", line: "warm, good days" },
  { key: "calm", label: "Calm", color: "#7FD1B9", line: "quiet, soft days" },
  { key: "mixed", label: "Mixed", color: "#B79CFF", line: "a bit of everything" },
  { key: "low", label: "Low", color: "#6F8FD8", line: "heavier days" },
  { key: "stormy", label: "Stormy", color: "#E0607A", line: "hard, loud days" },
  { key: "blank", label: "Unspoken", color: "#8A8D9F", line: "days without many feelings in words" },
];

export const MOOD = Object.fromEntries(MOODS.map((m) => [m.key, m])) as Record<DayMood, (typeof MOODS)[number]>;
