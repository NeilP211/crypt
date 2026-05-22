"use client";

import { useCallback, useRef, useState } from "react";

import { Filters } from "@/components/Filters";
import { LocationDetail, type DetailInfo } from "@/components/LocationDetail";
import { MapView } from "@/components/MapView";
import { ResultList } from "@/components/ResultList";
import { UploadDropzone } from "@/components/UploadDropzone";
import { api, ApiError } from "@/lib/api";
import type {
  BoundingBox,
  Location,
  ScoredLocation,
  SearchFilters,
} from "@/lib/types";

const EMPTY_FILTERS: SearchFilters = {
  era: [],
  structure_type: [],
  verified_status: [],
};

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

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [useLocation, setUseLocation] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);

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
          filters,
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
    [filters, useLocation, radiusKm],
  );

  const openDetail = useCallback((loc: DetailInfo & { id?: string }) => {
    setDetail(loc);
    if (loc.id) setSelectedId(loc.id);
  }, []);

  const showOnMap = useCallback((loc: DetailInfo) => {
    if (loc.lat != null && loc.lng != null) {
      setFocus({ lat: loc.lat, lng: loc.lng });
    }
    setDetail(null);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-ink-700 bg-ink-950 p-4">
        <div>
          <h1 className="font-display text-xl text-crimson">Visual Search</h1>
          <p className="mt-0.5 text-xs text-bone-400">
            Drop a photo to uncover haunted and abandoned places that resemble
            it — ranked by visual similarity, distance, and lore.
          </p>
        </div>

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
          filters={filters}
          onChange={setFilters}
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
      </aside>

      <div className="relative flex-1">
        <MapView
          locations={locations}
          results={results}
          onBboxChange={handleBbox}
          onOpenDetail={openDetail}
          focus={focus}
          selectedId={selectedId}
        />
      </div>

      <LocationDetail
        location={detail}
        onClose={() => setDetail(null)}
        onShowOnMap={showOnMap}
      />
    </div>
  );
}
