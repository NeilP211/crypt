"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { Location } from "@/lib/types";

// Text search over place names. Spans the whole index (not just the current
// map viewport) by hitting the backend search endpoint, debounced.
export function NameSearch({ onPick }: { onPick: (loc: Location) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .searchByName(q)
        .then((rows) => {
          setResults(rows);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search places by name"
        className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-400 focus:border-teal focus:outline-none"
      />
      {showList && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-ink-700 bg-ink-800 py-1 shadow-xl">
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs italic text-bone-400">Searching...</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs italic text-bone-400">
              No places match that name.
            </li>
          )}
          {results.map((loc) => (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(loc);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left transition hover:bg-ink-700"
              >
                <span className="block truncate text-sm text-bone-200">{loc.name}</span>
                <span className="block truncate text-[11px] text-bone-400">
                  {loc.structure_type && loc.structure_type !== "unknown"
                    ? titleCase(loc.structure_type)
                    : "haunted place"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
