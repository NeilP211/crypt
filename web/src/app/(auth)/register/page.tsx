"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(email, password, displayName);
      router.push("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "could not register");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-ink-700 bg-ink-900 p-6"
    >
      <h1 className="font-display text-lg font-semibold text-bone-200">
        Create an account
      </h1>
      <p className="mt-1 text-xs text-bone-400">
        Join the contributor community mapping forgotten places.
      </p>

      <label className="mt-4 block text-xs text-bone-400">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold"
        />
      </label>

      <label className="mt-3 block text-xs text-bone-400">
        Display name
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold"
        />
      </label>

      <label className="mt-3 block text-xs text-bone-400">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold"
        />
        <span className="mt-1 block text-[10px] text-bone-400">
          at least 8 characters
        </span>
      </label>

      {error && <p className="mt-3 text-xs text-demolished">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded bg-gold py-2 text-sm font-medium text-ink-950 transition hover:bg-gold-bright disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create account"}
      </button>

      <p className="mt-3 text-center text-xs text-bone-400">
        Already registered?{" "}
        <Link href="/login" className="text-gold hover:text-gold-bright">
          Sign in
        </Link>
      </p>
    </form>
  );
}
