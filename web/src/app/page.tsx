"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AskPanel } from "@/components/AskPanel";
import { BetaCard } from "@/components/BetaCard";
import { Filters } from "@/components/Filters";
import { categoryOf } from "@/components/HauntedGraphics";
import { LocationDetail, type DetailInfo } from "@/components/LocationDetail";
import { MapView } from "@/components/MapView";
import { NameSearch } from "@/components/NameSearch";
import { ResultList } from "@/components/ResultList";
import { UploadDropzone } from "@/components/UploadDropzone";
import { api, ApiError } from "@/lib/api";
import { spookyAudio } from "@/lib/audio";
import type { BoundingBox, Location, ScoredLocation } from "@/lib/types";

function currentPosition(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { timeout: 8000 },
    );
  });
}

export default function HomePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [results, setResults] = useState<ScoredLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailInfo | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [useLocation, setUseLocation] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);
  const [collapsed, setCollapsed] = useState(false);

  // Category filter applies to the ambient map dots (not the photo results).
  const visibleLocations = useMemo(
    () =>
      categories.length === 0
        ? locations
        : locations.filter((l) =>
            categories.includes(categoryOf(l.name, l.structure_type)),
          ),
    [locations, categories],
  );

  const bboxTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleBbox = useCallback((bbox: BoundingBox) => {
    // Debounce: only fetch once panning/zooming settles.
    if (bboxTimer.current) clearTimeout(bboxTimer.current);
    bboxTimer.current = setTimeout(() => {
      api
        .locationsInView(bbox)
        .then(setLocations)
        .catch(() => setLocations([]));
    }, 250);
  }, []);

  const runSearch = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setSearched(true);
      setPreview(URL.createObjectURL(file));
      try {
        const origin = useLocation ? await currentPosition() : undefined;
        const found = await api.searchByImage({
          file,
          origin,
          radiusMeters: useLocation ? radiusKm * 1000 : 0,
          limit: 20,
        });
        setResults(found);
        setSelectedId(found[0]?.id ?? null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [useLocation, radiusKm],
  );

  const openDetail = useCallback((loc: DetailInfo & { id?: string }) => {
    setDetail(loc);
    if (loc.id) setSelectedId(loc.id);
    spookyAudio.playCategory(categoryOf(loc.name, loc.structure_type));
  }, []);

  const showOnMap = useCallback((loc: DetailInfo) => {
    if (loc.lat != null && loc.lng != null) {
      setFocus({ lat: loc.lat, lng: loc.lng });
    }
    setDetail(null);
  }, []);

  const pickFromSearch = useCallback(
    (loc: Location) => {
      if (loc.lat != null && loc.lng != null) {
        setFocus({ lat: loc.lat, lng: loc.lng });
      }
      openDetail(loc);
    },
    [openDetail],
  );

  // The Ask agent returns cited places: route them through the same results
  // path as a photo search so they list in the sidebar and pin on the map.
  const handleAgentCited = useCallback((places: ScoredLocation[]) => {
    setResults(places);
    setSearched(true);
    setPreview(null);
    setError(null);
    setSelectedId(places[0]?.id ?? null);
    if (places[0]?.lat != null && places[0]?.lng != null) {
      setFocus({ lat: places[0].lat, lng: places[0].lng });
    }
  }, []);

  return (
    <div className="relative flex h-full overflow-hidden">
      <aside
        className={
          "flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-ink-700 bg-ink-950 p-4 transition-[margin] duration-300 ease-in-out " +
          (collapsed ? "-ml-[380px]" : "ml-0")
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl text-crimson">Visual Search</h1>
            <p className="mt-0.5 text-xs text-bone-400">
              Drop a photo to uncover haunted places to urbex. These places will
              resemble your photo by similarity, distance, and lore.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              spookyAudio.playEffect("stone");
              setCollapsed(true);
            }}
            aria-label="Hide panel"
            title="Hide panel"
            className="-mr-1 mt-0.5 shrink-0 rounded-md border border-ink-700 p-1.5 text-bone-400 transition hover:border-teal hover:text-teal-bright"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>

        <AskPanel onCited={handleAgentCited} />

        <NameSearch onPick={pickFromSearch} />

        <UploadDropzone onFile={runSearch} disabled={loading} />

        {preview && (
          <div className="flex items-center gap-2 rounded border border-ink-700 bg-ink-900 p-2">
            <img
              src={preview}
              alt="query"
              className="h-12 w-12 rounded object-cover"
            />
            <span className="text-xs text-bone-400">query image</span>
          </div>
        )}

        <Filters
          categories={categories}
          onCategoriesChange={setCategories}
          useLocation={useLocation}
          onUseLocationChange={setUseLocation}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
        />

        <ResultList
          results={results}
          loading={loading}
          error={error}
          searched={searched}
          selectedId={selectedId}
          onOpen={openDetail}
        />

        <BetaCard />
      </aside>

      <div className="relative flex-1">
        <MapView
          locations={visibleLocations}
          results={results}
          onBboxChange={handleBbox}
          onOpenDetail={openDetail}
          focus={focus}
          selectedId={selectedId}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          spookyAudio.playEffect("creak");
          setCollapsed(false);
        }}
        aria-label="Show panel"
        title="Show search panel"
        className={
          "absolute left-0 top-4 z-20 flex flex-col items-center gap-2 rounded-r-lg border border-l-0 border-ink-700 bg-ink-900/95 py-3 pl-1.5 pr-2 text-teal-bright shadow-lg backdrop-blur transition-all duration-300 ease-in-out hover:bg-ink-800 " +
          (collapsed
            ? "translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-full opacity-0")
        }
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="font-display text-xs tracking-wider [writing-mode:vertical-rl]">
          Search
        </span>
      </button>

      <LocationDetail
        location={detail}
        onClose={() => setDetail(null)}
        onShowOnMap={showOnMap}
      />
    </div>
  );
}
