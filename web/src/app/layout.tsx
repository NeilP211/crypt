import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/lib/auth";

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
    <html lang="en">
      <body className="flex h-full flex-col">
        <AuthProvider>
          <Nav />
          <main className="flex-1 overflow-hidden">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
