"use client";

import { useState } from "react";

import { CategoryGraphic } from "./HauntedGraphics";
import { api, ApiError } from "@/lib/api";
import { spookyAudio } from "@/lib/audio";
import { useAuth } from "@/lib/auth";
import { formatDistance, formatScore, titleCase } from "@/lib/format";
import type { ScoredLocation } from "@/lib/types";

interface ResultCardProps {
  result: ScoredLocation;
  rank: number;
  selected: boolean;
  onOpen: (result: ScoredLocation) => void;
}

const STATUS_STYLES: Record<string, string> = {
  verified: "text-verified border-verified/40",
  demolished: "text-demolished border-demolished/40",
  unverified: "text-bone-400 border-ink-600",
};

export function ResultCard({ result, rank, selected, onOpen }: ResultCardProps) {
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
        spookyAudio.playEffect("click");
      } else {
        await api.save(result.id, token);
        setSaved(true);
        spookyAudio.playEffect("chime");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      onClick={() => onOpen(result)}
      className={
        "flex cursor-pointer gap-3 rounded-lg border p-3 transition " +
        (selected
          ? "border-teal bg-ink-800"
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
          <CategoryGraphic name={result.name} structureType={result.structure_type} />
        )}
        <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center bg-crimson text-xs font-bold text-bone-200">
          {rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-bone-200">
            {result.name}
          </h3>
          <span className="shrink-0 font-mono text-sm font-bold text-gold-bright">
            {formatScore(result.hybrid_score)}
          </span>
        </div>

        {(result.structure_type !== "unknown" ||
          result.era !== "unknown" ||
          result.verified_status !== "unverified") && (
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
            {result.structure_type !== "unknown" && (
              <span className="rounded border border-ink-600 px-1.5 py-0.5 text-bone-400">
                {titleCase(result.structure_type)}
              </span>
            )}
            {result.era !== "unknown" && (
              <span className="rounded border border-ink-600 px-1.5 py-0.5 text-bone-400">
                {titleCase(result.era)}
              </span>
            )}
            {result.verified_status !== "unverified" && (
              <span
                className={
                  "rounded border px-1.5 py-0.5 " +
                  (STATUS_STYLES[result.verified_status] ?? STATUS_STYLES.unverified)
                }
              >
                {result.verified_status}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <dl className="flex gap-3 font-mono text-[10px] text-bone-400">
            <span>
              <dt className="inline">vec </dt>
              <dd className="inline text-bone-300">
                {formatScore(result.vector_score)}
              </dd>
            </span>
            <span>
              <dt className="inline">geo </dt>
              <dd className="inline text-bone-300">
                {formatScore(result.geo_score)}
              </dd>
            </span>
            {result.distance_meters >= 0 && (
              <span className="text-bone-300">
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
                ? "border-teal bg-teal/15 text-teal-bright"
                : "border-ink-600 text-bone-300 hover:border-teal")
            }
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        {result.description && (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-bone-400">
            {result.description}
          </p>
        )}
        {error && <p className="mt-1 text-[10px] text-demolished">{error}</p>}
      </div>
    </article>
  );
}
