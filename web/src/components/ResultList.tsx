"use client";

import { ResultCard } from "./ResultCard";
import type { ScoredLocation } from "@/lib/types";

interface ResultListProps {
  results: ScoredLocation[];
  loading: boolean;
  error: string | null;
  searched: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ResultList({
  results,
  loading,
  error,
  searched,
  selectedId,
  onSelect,
}: ResultListProps) {
  if (loading) {
    return (
      <p className="px-1 py-6 text-center font-mono text-sm text-bone-400">
        searching the index…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded border border-demolished/40 bg-demolished/10 px-3 py-3 text-sm text-demolished">
        {error}
      </p>
    );
  }
  if (!searched) {
    return null;
  }
  if (results.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-bone-400">
        No matches. Try widening the radius or clearing filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 font-mono text-xs text-bone-400">
        {results.length} result{results.length === 1 ? "" : "s"}, ranked by
        hybrid score
      </p>
      {results.map((result, index) => (
        <ResultCard
          key={result.id}
          result={result}
          rank={index + 1}
          selected={result.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
