"use client";

import { useEffect } from "react";

import { formatDistance, titleCase } from "@/lib/format";

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

/** A stylized haunted-house graphic shown when a location has no photo. */
function HauntedGraphic() {
  return (
    <svg viewBox="0 0 240 140" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="glow" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#bf2f43" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#5e1622" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0a090b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="140" fill="#0a090b" />
      <rect width="240" height="140" fill="url(#glow)" />
      <circle cx="158" cy="42" r="18" fill="#7d1d2b" opacity="0.9" />
      {/* bare tree */}
      <g stroke="#070708" strokeWidth="2.5" fill="none">
        <path d="M40 132 V86 M40 100 L28 90 M40 96 L52 84 M40 110 L30 104" />
      </g>
      {/* house silhouette */}
      <g fill="#070708">
        <polygon points="92,132 92,74 122,52 152,74 152,132" />
        <polygon points="88,76 122,50 156,76 122,50" stroke="#070708" strokeWidth="6" />
        <rect x="128" y="40" width="7" height="20" />
        <rect x="116" y="108" width="14" height="24" />
      </g>
      {/* glowing windows */}
      <g fill="#36b39a" opacity="0.9">
        <rect x="100" y="84" width="9" height="11" />
        <rect x="135" y="84" width="9" height="11" />
        <rect x="119" y="64" width="8" height="9" fill="#54d4ba" />
      </g>
      <rect y="130" width="240" height="10" fill="#070708" />
    </svg>
  );
}

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
            <HauntedGraphic />
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
