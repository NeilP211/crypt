import type { Metadata } from "next";
import { IM_Fell_English, Pirata_One } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

import { Nav } from "@/components/Nav";
import { SpookyOverlay } from "@/components/SpookyOverlay";
import { AuthProvider } from "@/lib/auth";

// A haunted, weathered type system: Pirata One (gothic blackletter) for the
// brand and titles; IM Fell English (a 17th-century antique press face) for
// body — both evoke decay and the uncanny.
const body = IM_Fell_English({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});
const display = Pirata_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crypt — Haunted Places & Urban Exploration",
  description:
    "Upload a photo and uncover haunted, abandoned, and forgotten places — visual search across thousands of locations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="flex h-full flex-col font-sans">
        <AuthProvider>
          <Nav />
          <main className="flex-1 overflow-hidden">{children}</main>
          <SpookyOverlay />
        </AuthProvider>
      </body>
    </html>
  );
}
