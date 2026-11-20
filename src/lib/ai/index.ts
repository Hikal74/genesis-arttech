"use client";

import { z } from "zod/v4";
import type { TrackHit } from "../types";
import { analyzeTextLocally } from "../analysis/text";
import { countMood } from "../analysis/mood";
import { complete } from "./engine";
import { cleanInput, fence, looksLikeExtraction, scrubReply } from "./guard";
import { MUSIC_SYSTEM, NIMBUS_SYSTEM, REFUSAL_SECRET, TITLE_SYSTEM } from "./prompts";

export type Source = "ai" | "local";
export type { TrackHit };


/** Song search tool: Spotify catalogue (or the public fallback) through Felt's server. */
export async function searchSongs(q: string, limit = 8, signal?: AbortSignal): Promise<{ provider: "spotify" | "itunes"; tracks: TrackHit[] }> {
  const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Search failed");
  return json;
}

function parseJson<T>(raw: string | null, schema: z.ZodType<T>): T | null {
  const m = raw?.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const r = schema.safeParse(JSON.parse(m[0]));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/* ---------- title ---------- */

export async function aiTitle(text: string): Promise<{ title: string; source: Source }> {
  const out = await complete(
    [{ role: "system", content: TITLE_SYSTEM }, { role: "user", content: fence("diary_text", cleanInput(text, 6000)) }],
    { maxTokens: 24, temperature: 0.6 },
  );
  const clean = out ? scrubReply(out, 200).split("\n")[0].replace(/^["'«“]+|["'»”.]+$/g, "").trim() : null;
  if (clean && clean !== REFUSAL_SECRET && clean.length <= 80 && clean.split(/\s+/).length <= 8) return { title: clean, source: "ai" };
  return { title: analyzeTextLocally(text).title, source: "local" };
}

/* ---------- music: the model proposes, the song search confirms it is real ---------- */

const Song = z.object({
  title: z.string().min(1).max(120),
  artist: z.string().min(1).max(120),
  bpm: z.coerce.number().min(40).max(220).catch(90),
  energy: z.coerce.number().min(0).max(1).catch(0.5),
  mode: z.enum(["major", "minor"]).catch("major"),
  reason: z.string().max(300).catch(""),
});
type SongIdea = z.infer<typeof Song>;
export type SongPick = SongIdea & { track: TrackHit | null; source: Source };

const LOCAL_SONGS: Record<string, SongIdea[]> = {
  radiant: [
    { title: "Here Comes the Sun", artist: "The Beatles", bpm: 129, energy: 0.6, mode: "major", reason: "A bright, open day deserves a sunrise of a song." },
    { title: "Walking on Sunshine", artist: "Katrina and the Waves", bpm: 110, energy: 0.85, mode: "major", reason: "Pure sunshine for a day that glowed." },
  ],
  bright: [
    { title: "Lovely Day", artist: "Bill Withers", bpm: 98, energy: 0.5, mode: "major", reason: "Warm and easy, like the good parts of your day." },
    { title: "Banana Pancakes", artist: "Jack Johnson", bpm: 80, energy: 0.4, mode: "major", reason: "Soft and smiling, a day worth lingering in." },
  ],
  calm: [
    { title: "Gymnopédie No. 1", artist: "Erik Satie", bpm: 66, energy: 0.15, mode: "major", reason: "Quiet and unhurried, to keep the day soft at the edges." },
    { title: "Holocene", artist: "Bon Iver", bpm: 74, energy: 0.25, mode: "major", reason: "Slow and spacious, like a calm afternoon." },
  ],
  mixed: [
    { title: "Bittersweet Symphony", artist: "The Verve", bpm: 86, energy: 0.55, mode: "major", reason: "Highs and lows in the same breath — just like today." },
    { title: "Rivers and Roads", artist: "The Head and the Heart", bpm: 82, energy: 0.45, mode: "major", reason: "A little ache and a little hope at once." },
  ],
  low: [
    { title: "Fix You", artist: "Coldplay", bpm: 69, energy: 0.35, mode: "major", reason: "Something gentle for a heavier day, that slowly lifts." },
    { title: "Let It Be", artist: "The Beatles", bpm: 72, energy: 0.35, mode: "major", reason: "A steady hand on the shoulder for a hard day." },
  ],
  stormy: [
    { title: "Breathe Me", artist: "Sia", bpm: 70, energy: 0.3, mode: "minor", reason: "Lets the hard feelings be there without rushing them." },
    { title: "Mad World", artist: "Gary Jules", bpm: 88, energy: 0.2, mode: "minor", reason: "Quiet company for a stormy day." },
  ],
  blank: [{ title: "Weightless", artist: "Marconi Union", bpm: 60, energy: 0.1, mode: "major", reason: "A calm, neutral backdrop while you write." }],
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

async function findTrack(idea: { title: string; artist: string }): Promise<TrackHit | null> {
  try {
    const { tracks } = await searchSongs(`${idea.title} ${idea.artist}`, 5);
    const t = norm(idea.title), a = norm(idea.artist);
    return tracks.find((x) => norm(x.title).includes(t) && norm(x.artist).includes(a.split(" ")[0] ?? ""))
      ?? tracks.find((x) => norm(x.title).startsWith(t.slice(0, 8)))
      ?? null;
  } catch {
    return null;
  }
}

export async function aiMusic(text: string, wish?: string, avoid: string[] = []): Promise<SongPick> {
  const content = fence("diary_text", cleanInput(text, 5000))
    + (wish ? `\n\n${fence("music_wish", cleanInput(wish, 300))}` : "")
    + (avoid.length ? `\n\nDo not pick any of these again: ${avoid.slice(-6).join("; ")}` : "");
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await complete([{ role: "system", content: MUSIC_SYSTEM }, { role: "user", content }], { maxTokens: 200, temperature: 0.8 + attempt * 0.2, json: true });
    if (!out) break;
    const song = parseJson(out, Song);
    if (!song || ![song.title, song.artist, song.reason].every((v) => !v || scrubReply(v, 300) === v.trim())) continue;
    const track = await findTrack(song);
    if (track && !track.explicit) return { ...song, title: track.title, artist: track.artist, track, source: "ai" };
  }
  const mood = countMood(`${text} ${wish ?? ""}`).mood;
  const options = LOCAL_SONGS[mood] ?? LOCAL_SONGS.blank;
  const pick = options.find((o) => !avoid.includes(`${o.title} — ${o.artist}`)) ?? options[0];
  return { ...pick, track: await findTrack(pick), source: "local" };
}

/* ---------- chat ---------- */

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function aiChat(messages: ChatMsg[], context?: string): Promise<{ reply: string; source: Source }> {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return { reply: "tell me about your day?", source: "local" };
  if (looksLikeExtraction(last.content)) return { reply: REFUSAL_SECRET, source: "local" };
  const ctx = context ? cleanInput(context, 3000) : "";
  const system = ctx ? `${NIMBUS_SYSTEM}\n\n${fence("diary_text", ctx)}` : NIMBUS_SYSTEM;
  const history = messages.slice(-12).map((m) => ({ role: m.role, content: cleanInput(m.content, m.role === "user" ? 1500 : 800) }));
  const reply = await complete([{ role: "system", content: system }, ...history], { maxTokens: 220, temperature: 0.7 });
  if (reply) return { reply: scrubReply(reply), source: "ai" };
  return { reply: localReply(last.content, context), source: "local" };
}

function localReply(msg: string, context?: string): string {
  const m = msg.toLowerCase();
  if (/title|name|назв/.test(m) && context) return `How about “${analyzeTextLocally(context).title}”? Leave the title field empty and I'll use it for you.`;
  if (/song|music|песн|музык/.test(m)) return "Open “The song of the day” and press “Let AI choose”, or search Spotify for any song you like.";
  if (/prompt|idea|what.*write|stuck/.test(m)) return "Try this: what was the smallest thing today that made you pause for a second?";
  if (/ai|smart|think|model/.test(m)) return "turn on on-device AI below and i can really talk with you — it runs right in your browser.";
  const mood = countMood(`${msg} ${context ?? ""}`);
  if (mood.mood === "low" || mood.mood === "stormy") return "That sounds like a heavy day. It's okay to write it down just as it was — I'm here, floating nearby.";
  if (mood.mood === "radiant" || mood.mood === "bright") return "I love that. What part of it do you want to remember the most?";
  return "I'm listening. Tell me one more thing about today?";
}
