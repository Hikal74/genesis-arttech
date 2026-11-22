import "server-only";
import type { TrackHit } from "../types";

interface ItunesTrack {
  trackId: number;
  trackName: string;
  trackViewUrl: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  trackExplicitness?: string;
}

const cache = new Map<string, { at: number; tracks: TrackHit[] }>();
const DAY = 24 * 60 * 60 * 1000;

async function searchCatalogue(query: string, limit: number): Promise<TrackHit[]> {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(query)}`;
  let res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const j = (await res.json()) as { results: ItunesTrack[] };
  return j.results.map((tr) => {
    const page = tr.trackViewUrl.replace(/[?&]uo=\d+/, "");
    return {
      id: String(tr.trackId),
      title: tr.trackName,
      artist: tr.artistName,
      album: tr.collectionName ?? null,
      image: tr.artworkUrl100?.replace("100x100", "300x300") ?? null,
      url: page,
      embedUrl: page.replace("https://music.apple.com", "https://embed.music.apple.com"),
      previewUrl: tr.previewUrl ?? null,
      durationMs: tr.trackTimeMillis ?? null,
      explicit: tr.trackExplicitness === "explicit",
    };
  });
}

export async function searchTracks(q: string, limit = 8): Promise<TrackHit[]> {
  const query = q.replace(/\s+/g, " ").trim().slice(0, 200);
  const key = `${query.toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.tracks;
  const tracks = await searchCatalogue(query, limit).catch(() => []);
  if (tracks.length) {
    cache.set(key, { at: Date.now(), tracks });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  }
  return tracks;
}
