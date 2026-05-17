"use client";

// Interactive MapLibre map. MapLibre is the open-source fork of Mapbox GL JS
// and needs no API token — the repository clones and runs. Tiles are CARTO's
// free dark basemap, which suits the urbex theme.

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

import type { BoundingBox, Location, ScoredLocation } from "@/lib/types";

const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

interface MapViewProps {
  /** Ambient pins for locations in the current viewport. */
  locations: Location[];
  /** Search results, drawn as bright ranked pins. */
  results: ScoredLocation[];
  onBboxChange?: (bbox: BoundingBox) => void;
  onSelect?: (id: string) => void;
  focus?: { lat: number; lng: number } | null;
  selectedId?: string | null;
}

function ambientMarker(): HTMLElement {
  const el = document.createElement("div");
  el.className =
    "h-2.5 w-2.5 rounded-full border border-ink-950 bg-haze-400/70 shadow";
  return el;
}

function resultMarker(rank: number, selected: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = String(rank);
  el.className =
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full " +
    "border-2 text-xs font-bold shadow-lg transition " +
    (selected
      ? "border-rust-bright bg-rust-bright text-ink-950 scale-125"
      : "border-ink-950 bg-rust text-ink-950 hover:scale-110");
  return el;
}

export function MapView({
  locations,
  results,
  onBboxChange,
  onSelect,
  focus,
  selectedId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const readyRef = useRef(false);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: [13.4036, 52.5145],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({}), "top-right");
    map.addControl(new maplibregl.GeolocateControl({}), "top-right");

    const emitBbox = () => {
      const b = map.getBounds();
      onBboxChange?.({
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast(),
      });
    };
    map.on("load", () => {
      readyRef.current = true;
      emitBbox();
    });
    map.on("moveend", emitBbox);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // onBboxChange is intentionally read once; the map lives for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers whenever locations or results change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    const resultIds = new Set(results.map((r) => r.id));
    for (const loc of locations) {
      if (resultIds.has(loc.id)) continue;
      const marker = new maplibregl.Marker({ element: ambientMarker() })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map);
      marker.getElement().addEventListener("click", () => onSelect?.(loc.id));
      markersRef.current.push(marker);
    }

    results.forEach((result, index) => {
      const el = resultMarker(index + 1, result.id === selectedId);
      el.addEventListener("click", () => onSelect?.(result.id));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([result.lng, result.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
            `<strong>${result.name}</strong>`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Frame the result set.
    if (results.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const r of results) bounds.extend([r.lng, r.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
    }
  }, [locations, results, selectedId, onSelect]);

  // Fly to an externally chosen location.
  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, duration: 800 });
    }
  }, [focus]);

  return <div ref={containerRef} className="h-full w-full" />;
}
