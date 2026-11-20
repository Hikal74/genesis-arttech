"use client";

import { MOOD } from "../moods";
import type { YearStats } from "../year";
import { shareImage } from "./postcard";

const W = 1080, H = 1920, PAD = 84, TOP = 250, BOTTOM = 260;
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** A 9:16 "my year in Felt" image for Instagram Stories. */
export async function makeYearCard(st: YearStats): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const top = st.topMood ? MOOD[st.topMood] : MOOD.blank;

  ctx.fillStyle = "#12131C";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.75, H * 0.18, 30, W * 0.75, H * 0.18, W * 1.1);
  g.addColorStop(0, `${top.color}70`);
  g.addColorStop(1, `${top.color}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  let y = TOP;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(`MY ${st.year} IN FELT`, PAD, y);

  y += 250;
  ctx.fillStyle = "#FFD83D";
  ctx.font = '700 260px "Bricolage Grotesque", "Inter Tight", sans-serif';
  ctx.fillText(String(st.days), PAD - 8, y);
  y += 70;
  ctx.fillStyle = "#fff";
  ctx.font = '300 54px "Fraunces", Georgia, serif';
  ctx.fillText(`${st.days === 1 ? "day" : "days"} felt · ${st.photos} photos`, PAD, y);

  // mood
  y += 130;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = '500 28px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText("MOSTLY FELT", PAD, y);
  y += 96;
  ctx.fillStyle = top.color;
  ctx.font = 'italic 300 104px "Fraunces", Georgia, serif';
  ctx.fillText(top.label.toLowerCase(), PAD, y);
  y += 44;
  const total = st.moods.reduce((n, m) => n + m.count, 0) || 1;
  let x = PAD;
  for (const m of st.moods) {
    const w = ((W - PAD * 2) * m.count) / total;
    ctx.fillStyle = MOOD[m.mood].color;
    ctx.fillRect(x, y, w, 22);
    x += w;
  }

  // months
  y += 110;
  const cell = (W - PAD * 2) / 12;
  st.months.forEach((m, i) => {
    const cx = PAD + cell * i + cell / 2;
    const r = cell / 2 - 8;
    if (m.colors.length) {
      const gr = ctx.createLinearGradient(cx - r, y - r, cx + r, y + r);
      m.colors.forEach((col, k) => gr.addColorStop(m.colors.length === 1 ? 0 : k / (m.colors.length - 1), col));
      ctx.fillStyle = gr;
    } else ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = '500 22px "JetBrains Mono", monospace';
    ctx.fillText(MONTHS[i], cx - 7, y + r + 34);
  });

  // words
  y += 170;
  if (st.words.length) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = '500 28px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText("MY WORDS", PAD, y);
    y += 70;
    ctx.font = '300 52px "Fraunces", Georgia, serif';
    let wx = PAD;
    for (const [i, w] of st.words.slice(0, 6).entries()) {
      const wWidth = ctx.measureText(w.word).width;
      if (wx + wWidth > W - PAD) { wx = PAD; y += 66; }
      ctx.fillStyle = i % 3 === 0 ? "#FFD83D" : "#fff";
      ctx.fillText(w.word, wx, y);
      wx += wWidth + 30;
    }
  }

  // song + mark
  ctx.font = '500 34px "Inter Tight", system-ui, sans-serif';
  ctx.fillStyle = "#FFD83D";
  if (st.songs[0]) ctx.fillText(`♪  ${st.songs[0].song}`.slice(0, 48), PAD, H - BOTTOM - 70);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = '600 40px "Bricolage Grotesque", "Inter Tight", sans-serif';
  ctx.fillText("felt", PAD, H - BOTTOM);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the image"))), "image/png"));
}

export async function shareYear(st: YearStats) {
  return shareImage(await makeYearCard(st), `felt-${st.year}-story.png`, `My ${st.year} in Felt`);
}
