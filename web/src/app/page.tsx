"use client";

import { useCallback, useState } from "react";

import { Filters } from "@/components/Filters";
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

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [useLocation, setUseLocation] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);

  const handleBbox = useCallback((bbox: BoundingBox) => {
    api
      .locationsInView(bbox)
      .then(setLocations)
      .catch(() => setLocations([]));
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

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const match =
        results.find((r) => r.id === id) ?? locations.find((l) => l.id === id);
      if (match) setFocus({ lat: match.lat, lng: match.lng });
    },
    [results, locations],
  );

  return (
    <div className="flex h-full">
      <aside className="flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-ink-700 bg-ink-950 p-4">
        <div>
          <h1 className="font-mono text-sm font-semibold text-haze-200">
            Visual search
          </h1>
          <p className="mt-0.5 text-xs text-haze-400">
            Find abandoned places that resemble a photo, ranked by a hybrid of
            CLIP similarity, distance, and metadata.
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
            <span className="text-xs text-haze-400">query image</span>
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
          onSelect={handleSelect}
        />
      </aside>

      <div className="relative flex-1">
        <MapView
          locations={locations}
          results={results}
          onBboxChange={handleBbox}
          onSelect={handleSelect}
          focus={focus}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}
