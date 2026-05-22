import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";

// Inter for UI/body; Cinzel (engraved gothic caps) for the brand and titles,
// echoing the ornate icon.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crypt — Geospatial Visual Search for Urban Exploration",
  description:
    "Upload a photo and find visually similar abandoned and historic places near you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="flex h-full flex-col font-sans">
        <AuthProvider>
          <Nav />
          <main className="flex-1 overflow-hidden">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
