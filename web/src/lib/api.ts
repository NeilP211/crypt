// Typed client for the crypt-server REST API.

import type {
  AuthResponse,
  BoundingBox,
  Contribution,
  Location,
  ScoredLocation,
  SearchFilters,
  User,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** An HTTP-level failure carrying the backend's error message and status. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "could not reach the Crypt API");
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface SearchImageParams {
  file: File;
  origin?: { lat: number; lng: number };
  radiusMeters?: number;
  filters?: SearchFilters;
  limit?: number;
}

function buildSearchForm(params: SearchImageParams): FormData {
  const form = new FormData();
  form.set("file", params.file);
  if (params.origin) {
    form.set("lat", String(params.origin.lat));
    form.set("lng", String(params.origin.lng));
  }
  if (params.radiusMeters) form.set("radius_meters", String(params.radiusMeters));
  if (params.limit) form.set("limit", String(params.limit));
  if (params.filters) {
    if (params.filters.era.length) form.set("era", params.filters.era.join(","));
    if (params.filters.structure_type.length) {
      form.set("structure_type", params.filters.structure_type.join(","));
    }
    if (params.filters.verified_status.length) {
      form.set("verified_status", params.filters.verified_status.join(","));
    }
  }
  return form;
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  /** Visual search: upload a photo and get ranked similar locations. */
  searchByImage: (params: SearchImageParams) =>
    request<ScoredLocation[]>("/api/search/image", {
      method: "POST",
      body: buildSearchForm(params),
    }),

  /** Locations within a map viewport, for rendering pins. */
  locationsInView: (bbox: BoundingBox) =>
    request<Location[]>(
      `/api/locations?min_lat=${bbox.minLat}&min_lng=${bbox.minLng}` +
        `&max_lat=${bbox.maxLat}&max_lng=${bbox.maxLng}`,
    ),

  location: (id: string) => request<Location>(`/api/locations/${id}`),

  savedLocations: (token: string) =>
    request<Location[]>("/api/saved", {}, token),

  save: (id: string, token: string) =>
    request<void>(`/api/saved/${id}`, { method: "POST" }, token),

  unsave: (id: string, token: string) =>
    request<void>(`/api/saved/${id}`, { method: "DELETE" }, token),

  contribute: (
    body: Omit<Contribution, "id" | "status">,
    token: string,
  ) =>
    request<Contribution>(
      "/api/contribute",
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  contributions: (token: string) =>
    request<Contribution[]>("/api/contributions", {}, token),
};
