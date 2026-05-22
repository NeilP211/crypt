"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { titleCase } from "@/lib/format";
import { ERA_OPTIONS, STRUCTURE_OPTIONS, type Contribution } from "@/lib/types";

const BLANK = {
  name: "",
  description: "",
  lat: "",
  lng: "",
  era: "unknown",
  structure_type: "unknown",
  image_url: "",
};

export default function ContributePage() {
  const { user, token, loading } = useAuth();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Contribution[]>([]);

  useEffect(() => {
    if (!token) return;
    api
      .contributions(token)
      .then(setMine)
      .catch(() => setMine([]));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("latitude and longitude must be numbers");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.contribute(
        {
          name: form.name,
          description: form.description,
          lat,
          lng,
          era: form.era,
          structure_type: form.structure_type,
          image_url: form.image_url,
        },
        token,
      );
      setMine((prev) => [created, ...prev]);
      setForm(BLANK);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "submission failed");
    } finally {
      setBusy(false);
    }
  }

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
          to contribute a location.
        </p>
      </Centered>
    );
  }

  const field =
    "mt-1 w-full rounded border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold";

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <h1 className="font-mono text-lg font-semibold text-bone-200">
        Contribute a location
      </h1>
      <p className="mt-0.5 text-xs text-bone-400">
        Submissions enter a review queue before joining the public index.
      </p>

      <form
        onSubmit={submit}
        className="mt-4 flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4"
      >
        <label className="block text-xs text-bone-400">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
        </label>

        <label className="block text-xs text-bone-400">
          Description
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={field}
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-xs text-bone-400">
            Latitude
            <input
              required
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              className={field}
              placeholder="52.5145"
            />
          </label>
          <label className="block flex-1 text-xs text-bone-400">
            Longitude
            <input
              required
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              className={field}
              placeholder="13.4036"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <label className="block flex-1 text-xs text-bone-400">
            Era
            <select
              value={form.era}
              onChange={(e) => setForm({ ...form, era: e.target.value })}
              className={field}
            >
              {ERA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {titleCase(o)}
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1 text-xs text-bone-400">
            Structure type
            <select
              value={form.structure_type}
              onChange={(e) =>
                setForm({ ...form, structure_type: e.target.value })
              }
              className={field}
            >
              {STRUCTURE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {titleCase(o)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-xs text-bone-400">
          Image URL
          <input
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            className={field}
            placeholder="https://…"
          />
        </label>

        {error && <p className="text-xs text-demolished">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gold py-2 text-sm font-medium text-ink-950 transition hover:bg-gold-bright disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit for review"}
        </button>
      </form>

      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-sm font-semibold text-bone-200">
            Your submissions
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {mine.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-ink-700 bg-ink-900 px-3 py-2"
              >
                <span className="text-sm text-bone-200">{c.name}</span>
                <span className="rounded border border-ink-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-bone-400">
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">{children}</div>
  );
}
