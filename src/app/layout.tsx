import type { Metadata } from "next";
import {
  Caveat,
  Commissioner,
  Cormorant,
  Fraunces,
  Kalam,
} from "next/font/google";

import "./globals.css";

/**
 * Typography layers:
 * - Kalam bold → handwritten top banner (notebook-heading feel).
 * - Cormorant roman → fancy serif hero label (“A Game on Paper”) — no italic needed.
 * - Fraunces → stamp flare (scores, seals, wins, stamped buttons).
 * - Commissioner + Caveat → UI body + scribble cues.
 */
const kalam = Kalam({
  subsets: ["latin"],
  variable: "--font-kalam",
  weight: ["400", "700"],
});

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const commissioner = Commissioner({
  subsets: ["latin"],
  variable: "--font-commissioner",
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RPS Reflex — Rock Paper Scissors with timing",
  description:
    "A polished, reflex-based Rock Paper Scissors game. Strike within the input window to win. Play against the AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${kalam.variable} ${cormorant.variable} ${fraunces.variable} ${commissioner.variable} ${caveat.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
