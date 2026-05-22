"use client";

import { titleCase } from "@/lib/format";
import {
  ERA_OPTIONS,
  STRUCTURE_OPTIONS,
  VERIFIED_OPTIONS,
  type SearchFilters,
} from "@/lib/types";

interface FiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  useLocation: boolean;
  onUseLocationChange: (value: boolean) => void;
  radiusKm: number;
  onRadiusChange: (value: number) => void;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-bone-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              className={
                "rounded-full border px-2.5 py-1 text-[11px] transition " +
                (active
                  ? "border-teal bg-teal/15 text-teal-bright"
                  : "border-ink-600 text-bone-400 hover:border-bone-400")
              }
            >
              {titleCase(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Filters({
  filters,
  onChange,
  useLocation,
  onUseLocationChange,
  radiusKm,
  onRadiusChange,
}: FiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
      <ChipGroup
        label="Structure"
        options={STRUCTURE_OPTIONS}
        selected={filters.structure_type}
        onToggle={(v) =>
          onChange({ ...filters, structure_type: toggle(filters.structure_type, v) })
        }
      />
      <ChipGroup
        label="Era"
        options={ERA_OPTIONS}
        selected={filters.era}
        onToggle={(v) => onChange({ ...filters, era: toggle(filters.era, v) })}
      />
      <ChipGroup
        label="Status"
        options={VERIFIED_OPTIONS}
        selected={filters.verified_status}
        onToggle={(v) =>
          onChange({ ...filters, verified_status: toggle(filters.verified_status, v) })
        }
      />

      <label className="flex items-center gap-2 text-xs text-bone-300">
        <input
          type="checkbox"
          checked={useLocation}
          onChange={(e) => onUseLocationChange(e.target.checked)}
          className="accent-teal"
        />
        Rank by distance from my location
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
