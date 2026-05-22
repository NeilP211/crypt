"use client";

// Interactive MapLibre map. MapLibre is the open-source fork of Mapbox GL JS
// and needs no API token — the repository clones and runs. Tiles are CARTO's
// free dark basemap, which suits the urbex theme.

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

import type { DetailInfo } from "./LocationDetail";
import type { BoundingBox, Location, ScoredLocation } from "@/lib/types";

// English place names (`name:en`) where available, else Latin transliteration,
// else the local name — so labels are consistently readable, not mixed scripts.
const ENGLISH_NAME = [
  "coalesce",
  ["get", "name:en"],
  ["get", "name:latin"],
  ["get", "name"],
];

// Minimal dark vector basemap built on OpenFreeMap (free, no API key). Only
// water, country borders, and place labels are drawn — labels in gold to match
// the Crypt brand, continents brightest.
const DARK_STYLE = {
  version: 8,
  // Pirata One SDF glyphs generated locally and served from public/fonts, so
  // the map labels wear the same gothic blackletter as the rest of the UI.
  glyphs: "/fonts/{fontstack}/{range}.pbf",
  sources: {
    // Proven dark raster base (renders everywhere), plus a vector source used
    // only for the gold English labels drawn on top.
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
    omt: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: "© OpenMapTiles",
    },
  },
  layers: [
    { id: "base", type: "raster", source: "carto" },
    // Bleed crimson over the seas and lakes for a haunted look — the vector
    // water polygons cover the raster's dark water.
    {
      id: "water-blood",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      paint: { "fill-color": "#5e1622", "fill-opacity": 0.92 },
    },
    {
      id: "label-city",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      minzoom: 4,
      filter: ["match", ["get", "class"], ["city", "town", "state"], true, false],
      layout: {
        "text-field": ENGLISH_NAME,
        "text-font": ["PirataOne"],
        "text-size": 11,
      },
      paint: {
        "text-color": "#9b7a2e",
        "text-halo-color": "#0a090b",
        "text-halo-width": 1,
      },
    },
    {
      id: "label-country",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": ENGLISH_NAME,
        "text-font": ["PirataOne"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, 10, 5, 14],
      },
      paint: {
        "text-color": "#c79a3e",
        "text-halo-color": "#0a090b",
        "text-halo-width": 1,
      },
    },
    {
      id: "label-continent",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "continent"],
      layout: {
        "text-field": ENGLISH_NAME,
        "text-font": ["PirataOne"],
        "text-size": 16,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.25,
      },
      paint: {
        "text-color": "#e6b84e",
        "text-halo-color": "#0a090b",
        "text-halo-width": 1.4,
      },
    },
  ],
} as maplibregl.StyleSpecification;

interface MapViewProps {
  /** Ambient pins for locations in the current viewport. */
  locations: Location[];
  /** Search results, drawn as bright ranked pins. */
  results: ScoredLocation[];
  onBboxChange?: (bbox: BoundingBox) => void;
  /** Open the full detail panel for a clicked location. */
  onOpenDetail?: (loc: DetailInfo) => void;
  focus?: { lat: number; lng: number } | null;
  selectedId?: string | null;
}

function resultMarker(rank: number, selected: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = String(rank);
  el.className =
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full " +
    "border-2 text-xs font-bold shadow-lg transition " +
    (selected
      ? "border-crimson bg-crimson text-bone-200 scale-125"
      : "border-ink-950 bg-teal text-ink-950 hover:scale-110");
  return el;
}

export function MapView({
  locations,
  results,
  onBboxChange,
  onOpenDetail,
  focus,
  selectedId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const readyRef = useRef(false);
  // Always call the latest handler from the once-created map listeners.
  const onOpenDetailRef = useRef(onOpenDetail);
  onOpenDetailRef.current = onOpenDetail;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      // Open framed on the continental US, where the dataset lives.
      center: [-96, 38],
      zoom: 3.3,
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
      // Ambient location dots as a GPU-rendered circle layer — scales to
      // thousands of points without the pan/zoom lag of DOM markers.
      map.addSource("ambient", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "ambient-circles",
        type: "circle",
        source: "ambient",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.5, 8, 5.5],
          "circle-color": "#36b39a",
          "circle-opacity": 0.8,
          "circle-stroke-color": "#0a090b",
          "circle-stroke-width": 1,
        },
      });
      map.on("click", "ambient-circles", (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const [lng, lat] = feature.geometry.coordinates as [number, number];
        onOpenDetailRef.current?.({
          ...(feature.properties as unknown as DetailInfo),
          lat,
          lng,
        });
      });
      map.on("mouseenter", "ambient-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "ambient-circles", () => {
        map.getCanvas().style.cursor = "";
      });

      readyRef.current = true;
      emitBbox();
    });
    map.on("moveend", emitBbox);

    // Keep the canvas matched to its container as the sidebar collapses or
    // the window changes, not just on window resize events.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // onBboxChange is intentionally read once; the map lives for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed ambient locations (minus the current results) into the circle layer.
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("ambient") as maplibregl.GeoJSONSource | undefined;
    if (!map || !source) return;
    const resultIds = new Set(results.map((r) => r.id));
    source.setData({
      type: "FeatureCollection",
      features: locations
        .filter((loc) => !resultIds.has(loc.id))
        .map((loc) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
          properties: {
            id: loc.id,
            name: loc.name,
            structure_type: loc.structure_type,
            era: loc.era,
            verified_status: loc.verified_status,
            image_url: loc.image_url,
            description: loc.description,
          },
        })),
    });
  }, [locations, results]);

  // Search results as DOM markers (few, ranked, individually interactive).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    results.forEach((result, index) => {
      const el = resultMarker(index + 1, result.id === selectedId);
      el.addEventListener("click", () => onOpenDetail?.(result));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([result.lng, result.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (results.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const r of results) bounds.extend([r.lng, r.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
    }
  }, [results, selectedId, onOpenDetail]);

  // Fly to an externally chosen location.
  useEffect(() => {
    if (focus && mapRef.current) {
      mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 15, duration: 800 });
    }
  }, [focus]);

  return <div ref={containerRef} className="h-full w-full" />;
}
