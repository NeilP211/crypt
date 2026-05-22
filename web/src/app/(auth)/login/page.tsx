"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-ink-700 bg-ink-900 p-6"
    >
      <h1 className="font-mono text-lg font-semibold text-bone-200">Sign in</h1>
      <p className="mt-1 text-xs text-bone-400">
        Access saved locations and contribute new sites.
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
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold"
        />
      </label>

      {error && <p className="mt-3 text-xs text-demolished">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded bg-gold py-2 text-sm font-medium text-ink-950 transition hover:bg-gold-bright disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-3 text-center text-xs text-bone-400">
        No account?{" "}
        <Link href="/register" className="text-gold hover:text-gold-bright">
          Register
        </Link>
      </p>
    </form>
  );
}
