"use client";

import { useEffect, type ReactNode } from "react";

import { CategoryGraphic } from "./HauntedGraphics";
import { formatDistance, titleCase } from "@/lib/format";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded border border-ink-600 px-2 py-1 text-bone-300 transition hover:border-teal hover:text-teal-bright"
    >
      {children}
    </a>
  );
}

export interface DetailInfo {
  name: string;
  description?: string;
  structure_type: string;
  era: string;
  verified_status: string;
  image_url?: string;
  lat?: number;
  lng?: number;
  distance_meters?: number;
}

const STATUS_STYLE: Record<string, string> = {
  verified: "border-verified/40 text-verified",
  demolished: "border-demolished/40 text-demolished",
  unverified: "border-ink-600 text-bone-400",
};

interface LocationDetailProps {
  location: DetailInfo | null;
  onClose: () => void;
  onShowOnMap?: (loc: DetailInfo) => void;
}

export function LocationDetail({ location, onClose, onShowOnMap }: LocationDetailProps) {
  useEffect(() => {
    if (!location) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location, onClose]);

  if (!location) return null;

  const badges: { label: string; cls: string }[] = [];
  if (location.structure_type && location.structure_type !== "unknown") {
    badges.push({ label: titleCase(location.structure_type), cls: STATUS_STYLE.unverified });
  }
  if (location.era && location.era !== "unknown") {
    badges.push({ label: titleCase(location.era), cls: STATUS_STYLE.unverified });
  }
  if (location.verified_status && location.verified_status !== "unverified") {
    badges.push({
      label: location.verified_status,
      cls: STATUS_STYLE[location.verified_status] ?? STATUS_STYLE.unverified,
    });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/70 text-bone-300 transition hover:text-bone-200"
        >
          ✕
        </button>

        <div className="h-40 w-full shrink-0 bg-ink-950">
          {location.image_url ? (
            <img
              src={location.image_url}
              alt={location.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <CategoryGraphic name={location.name} structureType={location.structure_type} />
          )}
        </div>

        <div className="overflow-y-auto p-5">
          <h2 className="font-display text-2xl leading-tight text-crimson">
            {location.name}
          </h2>

          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
              {badges.map((b) => (
                <span key={b.label} className={`rounded border px-1.5 py-0.5 ${b.cls}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 text-sm leading-relaxed text-bone-200">
            {location.description?.trim() || (
              <span className="italic text-bone-400">No account recorded for this place.</span>
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <p className="w-full font-mono text-[10px] uppercase tracking-wider text-bone-400">
              Dig deeper
            </p>
            <ExternalLink
              href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(location.name)}`}
            >
              Wikipedia
            </ExternalLink>
            <ExternalLink
              href={`https://www.google.com/search?q=${encodeURIComponent(`${location.name} haunted`)}`}
            >
              Web search
            </ExternalLink>
            {location.lat != null && location.lng != null && (
              <ExternalLink
                href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
              >
                Street view
              </ExternalLink>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3 font-mono text-[11px] text-bone-400">
            <span>
              {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}
              {location.distance_meters != null && location.distance_meters >= 0 && (
                <span className="ml-2 text-bone-300">
                  {formatDistance(location.distance_meters)} away
                </span>
              )}
            </span>
            {onShowOnMap && (
              <button
                onClick={() => onShowOnMap(location)}
                className="rounded border border-teal px-2.5 py-1 text-teal-bright transition hover:bg-teal/15"
              >
                Show on map
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
