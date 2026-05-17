"use client";

import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDistance, formatScore, titleCase } from "@/lib/format";
import type { ScoredLocation } from "@/lib/types";

interface ResultCardProps {
  result: ScoredLocation;
  rank: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  verified: "text-verified border-verified/40",
  demolished: "text-demolished border-demolished/40",
  unverified: "text-haze-400 border-ink-600",
};

export function ResultCard({ result, rank, selected, onSelect }: ResultCardProps) {
  const { token } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSave() {
    if (!token) {
      setError("sign in to save");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (saved) {
        await api.unsave(result.id, token);
        setSaved(false);
      } else {
        await api.save(result.id, token);
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      onClick={() => onSelect(result.id)}
      className={
        "flex cursor-pointer gap-3 rounded-lg border p-3 transition " +
        (selected
          ? "border-rust bg-ink-800"
          : "border-ink-700 bg-ink-900 hover:border-ink-600")
      }
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-ink-800">
        {result.image_url ? (
          <img
            src={result.image_url}
            alt={result.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-haze-400">
            no image
          </div>
        )}
        <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center bg-rust text-xs font-bold text-ink-950">
          {rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-haze-200">
            {result.name}
          </h3>
          <span className="shrink-0 font-mono text-sm font-bold text-rust-bright">
            {formatScore(result.hybrid_score)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
          <span className="rounded border border-ink-600 px-1.5 py-0.5 text-haze-400">
            {titleCase(result.structure_type)}
          </span>
          <span className="rounded border border-ink-600 px-1.5 py-0.5 text-haze-400">
            {titleCase(result.era)}
          </span>
          <span
            className={
              "rounded border px-1.5 py-0.5 " +
              (STATUS_STYLES[result.verified_status] ?? STATUS_STYLES.unverified)
            }
          >
            {result.verified_status}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <dl className="flex gap-3 font-mono text-[10px] text-haze-400">
            <span>
              <dt className="inline">vec </dt>
              <dd className="inline text-haze-300">
                {formatScore(result.vector_score)}
              </dd>
            </span>
            <span>
              <dt className="inline">geo </dt>
              <dd className="inline text-haze-300">
                {formatScore(result.geo_score)}
              </dd>
            </span>
            {result.distance_meters >= 0 && (
              <span className="text-haze-300">
                {formatDistance(result.distance_meters)}
              </span>
            )}
          </dl>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggleSave();
            }}
            disabled={busy}
            className={
              "rounded border px-2 py-0.5 text-[11px] transition disabled:opacity-50 " +
              (saved
                ? "border-rust bg-rust/15 text-rust-bright"
                : "border-ink-600 text-haze-300 hover:border-rust")
            }
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        {error && <p className="mt-1 text-[10px] text-demolished">{error}</p>}
      </div>
    </article>
  );
}
