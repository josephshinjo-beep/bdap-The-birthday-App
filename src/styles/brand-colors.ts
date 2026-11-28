// The brand colours as plain values, for places CSS variables can't reach: the PWA icons
// are drawn by next/og (ImageResponse), which takes literal colours only.
// Keep these in step with src/styles/theme.css.
export const BRAND = {
  accent: "#ff4f7b",
  sun: "#ffd23f",
  ink: "#221b3a",
} as const;
