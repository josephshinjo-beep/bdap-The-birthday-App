// Fonts for the theme. Swap the families here; theme.css picks them up
// through --font-display-src, --font-body-src and --font-mono-src.
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from "next/font/google";

export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display-src",
  display: "swap",
});

export const bodyFont = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body-src",
  display: "swap",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono-src",
  display: "swap",
});

export const fontVariables = `${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`;
