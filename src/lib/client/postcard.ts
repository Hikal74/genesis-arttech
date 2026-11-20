"use client";

import type { Entry } from "../types";
import { MOOD } from "../moods";
import { countMood } from "../analysis/mood";

const W = 1080, H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  return lines;
}

/** Draws a shareable 4:5 postcard of one memory and returns it as a PNG blob. */
export async function makePostcard(entry: Entry): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const p = entry.design.palette;
  const mood = MOOD[countMood(entry.text).mood];

  // ground with a soft glow
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.8, H * 0.1, 40, W * 0.8, H * 0.1, W);
  g.addColorStop(0, `${p.glow}66`);
  g.addColorStop(1, `${p.glow}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // photographs: one big, up to two small
  const imgs = (await Promise.all(entry.photos.slice(0, 3).map((ph) => loadImage(ph.media.url)))).filter((x): x is HTMLImageElement => Boolean(x));
  const pad = 72;
  const photoH = 720;
  ctx.save();
  if (imgs.length >= 2) {
    const big = (W - pad * 2) * 0.64;
    cover(ctx, imgs[0], pad, pad, big - 8, photoH);
    const smallW = W - pad * 2 - big;
    const smallH = imgs[2] ? photoH / 2 - 8 : photoH;
    cover(ctx, imgs[1], pad + big + 8, pad, smallW - 8, smallH);
    if (imgs[2]) cover(ctx, imgs[2], pad + big + 8, pad + photoH / 2 + 8, smallW - 8, photoH / 2 - 8);
  } else if (imgs[0]) {
    cover(ctx, imgs[0], pad, pad, W - pad * 2, photoH);
  } else {
    ctx.fillStyle = p.surface;
    ctx.fillRect(pad, pad, W - pad * 2, photoH);
  }
  ctx.restore();

  // palette strip
  const sw = p.swatches.slice(0, 6);
  sw.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(pad + i * ((W - pad * 2) / sw.length), pad + photoH + 24, (W - pad * 2) / sw.length, 14);
  });

  // date + mood
  let y = pad + photoH + 92;
  ctx.fillStyle = p.muted;
  ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
  const date = new Date(`${entry.day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  ctx.fillText(date, pad, y);
  ctx.fillStyle = mood.color;
  const mw = ctx.measureText(mood.label.toUpperCase()).width;
  ctx.beginPath();
  ctx.arc(W - pad - mw - 22, y - 9, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(mood.label.toUpperCase(), W - pad - mw, y);

  // title
  y += 34;
  ctx.fillStyle = p.ink;
  ctx.font = '300 84px "Fraunces", Georgia, serif';
  for (const line of wrap(ctx, entry.title, W - pad * 2, 2)) {
    y += 86;
    ctx.fillText(line, pad, y);
  }

  // atmosphere line
  ctx.fillStyle = p.muted;
  ctx.font = 'italic 300 34px "Fraunces", Georgia, serif';
  for (const line of wrap(ctx, entry.analysis.atmosphereLine, W - pad * 2, 2)) {
    y += 46;
    ctx.fillText(line, pad, y);
  }

  // song + mark
  const song = entry.music.kind === "file" ? entry.music.name : [entry.music.title, entry.music.artist].filter(Boolean).join(" — ");
  ctx.font = '500 28px "Inter Tight", system-ui, sans-serif';
  ctx.fillStyle = p.accent;
  if (song) ctx.fillText(`♪  ${song}`.slice(0, 60), pad, H - pad);
  ctx.fillStyle = p.muted;
  ctx.font = '600 30px "Bricolage Grotesque", "Inter Tight", sans-serif';
  const mark = "felt";
  ctx.fillText(mark, W - pad - ctx.measureText(mark).width, H - pad);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the postcard"))), "image/png"));
}

export async function sharePostcard(entry: Entry): Promise<"shared" | "downloaded"> {
  const blob = await makePostcard(entry);
  const name = `felt-${entry.day}-${entry.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: entry.title });
      return "shared";
    } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
