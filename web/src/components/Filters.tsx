"use client";

import { CATEGORIES } from "./HauntedGraphics";

interface FiltersProps {
  categories: string[];
  onCategoriesChange: (categories: string[]) => void;
  useLocation: boolean;
  onUseLocationChange: (value: boolean) => void;
  radiusKm: number;
  onRadiusChange: (value: number) => void;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Filters({
  categories,
  onCategoriesChange,
  useLocation,
  onUseLocationChange,
  radiusKm,
  onRadiusChange,
}: FiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
            Show on map
          </p>
          {categories.length > 0 && (
            <button
              onClick={() => onCategoriesChange([])}
              className="font-mono text-[10px] text-bone-400 underline hover:text-bone-200"
            >
              clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(({ key, label }) => {
            const active = categories.includes(key);
            return (
              <button
                key={key}
                onClick={() => onCategoriesChange(toggle(categories, key))}
                className={
                  "rounded-full border px-2.5 py-1 text-[11px] transition " +
                  (active
                    ? "border-teal bg-teal/15 text-teal-bright"
                    : "border-ink-600 text-bone-400 hover:border-bone-400")
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px] italic text-bone-400">
          {categories.length === 0
            ? "All categories shown."
            : "Only the selected categories appear on the map."}
        </p>
      </div>

      <label className="flex items-center gap-2 border-t border-ink-700 pt-3 text-xs text-bone-300">
        <input
          type="checkbox"
          checked={useLocation}
          onChange={(e) => onUseLocationChange(e.target.checked)}
          className="accent-teal"
        />
        Rank search by distance from my location
      </label>

      {useLocation && (
        <label className="flex flex-col gap-1 text-xs text-bone-400">
          <span>Search radius: {radiusKm} km</span>
          <input
            type="range"
            min={1}
            max={500}
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="accent-teal"
          />
        </label>
      )}
    </div>
  );
}
