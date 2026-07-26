import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import "./session.css";
import "./planner.css";
import "./calendar.css";
import "./moderation.css";
import "./profile.css";
import "./games.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Lobby Night — Play more. Plan less.",
  description: "Find the best time and the right game for your Steam group.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${inter.variable} ${manrope.variable}`}>{children}</body></html>;
}
