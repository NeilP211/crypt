// Shared API types. These mirror the JSON the Rust backend emits — the
// backend flattens `ScoredLocation` so a result carries every `Location`
// field at the top level alongside its scores.

export interface Location {
  id: string;
  embedding_id: number | null;
  name: string;
  description: string;
  lat: number;
  lng: number;
  era: string;
  structure_type: string;
  verified_status: string;
  image_url: string;
  source: string;
}

export interface ScoredLocation extends Location {
  vector_score: number;
  geo_score: number;
  metadata_score: number;
  hybrid_score: number;
  distance_meters: number;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  era: string;
  structure_type: string;
  image_url: string;
  status: string;
}

export interface SearchFilters {
  era: string[];
  structure_type: string[];
  verified_status: string[];
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export const ERA_OPTIONS = [
  "pre-industrial",
  "industrial",
  "wartime",
  "mid-century",
  "modern",
  "unknown",
] as const;

export const STRUCTURE_OPTIONS = [
  "castle",
  "religious",
  "hospital",
  "factory",
  "residential",
  "rail",
  "mine",
  "military",
  "ruins",
  "unknown",
] as const;

export const VERIFIED_OPTIONS = ["verified", "unverified", "demolished"] as const;
