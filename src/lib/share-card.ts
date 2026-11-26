"use client";
// Draws a 1080×1920 birthday story card (Instagram story size) on a canvas.
// Shared with the Web Share API (on phones this offers Instagram), or downloaded.

export type CardTheme = "party" | "sunshine";

export interface StoryCardInput {
  name: string;
  roomName: string;
  wishCount: number;
  /** A line under the name: the plan for the day, or anything the user types. */
  line: string | null;
  /** A few short public wishes to print as notes. */
  quotes: { text: string; author: string }[];
  theme: CardTheme;
}

const W = 1080;
const H = 1920;

const THEMES: Record<CardTheme, { bg: [string, string, string]; ink: string; sub: string; accent: string; notes: string[] }> = {
  party: { bg: ["#2a1f4f", "#4b2a6e", "#ff4f7b"], ink: "#ffffff", sub: "#e8defd", accent: "#ffd23f", notes: ["#ffd23f", "#ffe3ea", "#d8f6ee"] },
  sunshine: { bg: ["#fff8ec", "#ffe9b8", "#ffd23f"], ink: "#2a1f4f", sub: "#6b6385", accent: "#ff4f7b", notes: ["#ffffff", "#ffe3ea", "#d8f6ee"] },
};

function fontFamily(variable: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function balloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.15);
  ctx.bezierCurveTo(x - 20, y + r * 1.6, x + 20, y + r * 2.1, x, y + r * 2.7);
  ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, "rgba(255,255,255,0.75)");
  g.addColorStop(0.25, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.86, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 12, y + r + 14);
  ctx.lineTo(x + 12, y + r + 14);
  ctx.lineTo(x, y + r - 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export async function drawStoryCard(input: StoryCardInput): Promise<Blob> {
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const t = THEMES[input.theme];
  const display = fontFamily("--font-display", "Trebuchet MS, sans-serif");
  const body = fontFamily("--font-body", "system-ui, sans-serif");

  // background
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, t.bg[0]);
  bg.addColorStop(0.6, t.bg[1]);
  bg.addColorStop(1, t.bg[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // confetti dots
  const dots = ["#ff4f7b", "#ffd23f", "#2ec4a0", "#4d8bff", "#ffffff"];
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = dots[i % dots.length]!;
    ctx.globalAlpha = 0.55;
    const x = (i * 197) % W;
    const y = (i * 313) % 760;
    ctx.fillRect(x, y, 14, 22);
  }
  ctx.globalAlpha = 1;

  balloon(ctx, 170, 330, 110, "#ff4f7b");
  balloon(ctx, 900, 260, 95, "#ffd23f");
  balloon(ctx, 760, 470, 70, "#2ec4a0");

  // headline
  ctx.fillStyle = t.ink;
  ctx.textAlign = "center";
  ctx.font = `800 96px ${display}`;
  ctx.fillText("Happy birthday", W / 2, 760);
  ctx.fillStyle = t.accent;
  ctx.font = `800 150px ${display}`;
  const nameLines = wrap(ctx, `${input.name}!`, W - 140);
  nameLines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 920 + i * 150));
  let y = 920 + Math.min(2, nameLines.length) * 150 - 30;

  ctx.fillStyle = t.sub;
  ctx.font = `500 44px ${body}`;
  ctx.fillText(`From ${input.roomName}${input.wishCount ? ` · ${input.wishCount} notes on the wall` : ""}`, W / 2, y + 40);
  y += 100;

  // plan / custom line
  if (input.line) {
    ctx.font = `600 42px ${body}`;
    const lines = wrap(ctx, input.line, W - 260).slice(0, 4);
    const boxH = 70 + lines.length * 56;
    ctx.fillStyle = input.theme === "party" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.75)";
    roundRect(ctx, 100, y, W - 200, boxH, 36);
    ctx.fill();
    ctx.fillStyle = t.ink;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 70 + i * 56));
    y += boxH + 50;
  }

  // a few notes
  const quotes = input.quotes.slice(0, 3);
  const noteW = 280;
  const gap = 30;
  const startX = (W - (quotes.length * noteW + (quotes.length - 1) * gap)) / 2;
  quotes.forEach((q, i) => {
    const x = startX + i * (noteW + gap);
    const rot = (i - 1) * 0.06;
    ctx.save();
    ctx.translate(x + noteW / 2, y + 150);
    ctx.rotate(rot);
    ctx.fillStyle = t.notes[i % t.notes.length]!;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillRect(-noteW / 2, -150, noteW, 300);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(-50, -168, 100, 34);
    ctx.fillStyle = "#2a1f4f";
    ctx.textAlign = "left";
    ctx.font = `500 30px ${body}`;
    wrap(ctx, q.text, noteW - 40)
      .slice(0, 6)
      .forEach((l, j) => ctx.fillText(l, -noteW / 2 + 20, -100 + j * 38));
    ctx.font = `700 26px ${body}`;
    ctx.fillStyle = "#6b6385";
    ctx.fillText(`— ${q.author.split(" ")[0]}`, -noteW / 2 + 20, 125);
    ctx.restore();
  });

  // footer
  ctx.textAlign = "center";
  ctx.fillStyle = t.ink;
  ctx.font = `800 52px ${display}`;
  ctx.fillText("bdap", W / 2, H - 110);
  ctx.fillStyle = t.sub;
  ctx.font = `500 30px ${body}`;
  ctx.fillText("the birthday app", W / 2, H - 65);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the card"))), "image/png"));
}

/** One tap: the share sheet on phones (Instagram shows up there), otherwise a download. */
export async function shareStoryCard(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
