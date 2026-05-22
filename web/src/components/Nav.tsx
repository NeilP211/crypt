"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth";

export function Nav() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900/95 px-5 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2.5">
        <img
          src="/brand.png"
          alt="Crypt"
          className="h-8 w-8 rounded-md shadow-glow"
        />
        <span className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl tracking-wide text-teal">
            Crypt
          </span>
          <span className="hidden text-xs italic text-bone-400 sm:inline">
            haunted places &amp; urban exploration
          </span>
        </span>
      </Link>

      <nav className="flex items-center gap-1 text-sm">
        <NavLink href="/">Search</NavLink>
        {user && <NavLink href="/saved">Saved</NavLink>}
        {user && <NavLink href="/contribute">Contribute</NavLink>}

        {!loading && user && (
          <div className="ml-3 flex items-center gap-3 border-l border-ink-700 pl-3">
            <span className="hidden text-xs text-bone-300 sm:inline">
              {user.display_name || user.email}
            </span>
            <button
              onClick={logout}
              className="rounded border border-ink-600 px-2.5 py-1 text-xs text-bone-300 transition hover:border-teal hover:text-teal-bright"
            >
              Sign out
            </button>
          </div>
        )}

        {!loading && !user && (
          <div className="ml-2 flex items-center gap-2">
            <NavLink href="/login">Sign in</NavLink>
            <Link
              href="/register"
              className="rounded bg-teal px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:bg-teal-bright"
            >
              Register
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded px-2.5 py-1.5 text-bone-300 transition hover:bg-ink-700 hover:text-bone-200"
    >
      {children}
    </Link>
  );
}
