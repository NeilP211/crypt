"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { titleCase } from "@/lib/format";
import type { Location } from "@/lib/types";

export default function SavedPage() {
  const { user, token, loading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    if (!token) {
      setPending(false);
      return;
    }
    api
      .savedLocations(token)
      .then(setLocations)
      .catch(() => setLocations([]))
      .finally(() => setPending(false));
  }, [token]);

  if (loading) {
    return <Centered>loading…</Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <p className="text-sm text-bone-400">
          <Link href="/login" className="text-gold hover:text-gold-bright">
            Sign in
          </Link>{" "}
          to see your saved locations.
        </p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-6">
      <h1 className="font-mono text-lg font-semibold text-bone-200">
        Saved locations
      </h1>
      <p className="mt-0.5 text-xs text-bone-400">
        {locations.length} bookmarked place{locations.length === 1 ? "" : "s"}
      </p>

      {pending ? (
        <p className="mt-8 text-center text-sm text-bone-400">loading…</p>
      ) : locations.length === 0 ? (
        <p className="mt-8 text-center text-sm text-bone-400">
          Nothing saved yet — run a search and tap “Save” on a result.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className="flex gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ink-800">
                {loc.image_url && (
                  <img
                    src={loc.image_url}
                    alt={loc.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-bone-200">
                  {loc.name}
                </h2>
                <p className="mt-0.5 text-xs text-bone-400">
                  {titleCase(loc.structure_type)} · {titleCase(loc.era)} ·{" "}
                  {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </p>
                {loc.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-bone-400">
                    {loc.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">{children}</div>
  );
}
