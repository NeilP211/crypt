// Small presentation helpers shared across components.

/** Format a distance in meters as a short human string. */
export function formatDistance(meters: number): string {
  if (meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format a `[0, 1]` score as a whole-number percentage. */
export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Turn a `snake_case` / `kebab-case` enum value into Title Case. */
export function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
