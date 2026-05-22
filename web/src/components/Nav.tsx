"use client";

import Link from "next/link";
import { useState } from "react";

import { InfoTip } from "./InfoTip";
import { spookyAudio } from "@/lib/audio";
import { useAuth } from "@/lib/auth";

export function Nav() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="relative z-40 flex items-center justify-between border-b border-ink-700 bg-ink-900/95 px-5 py-3 backdrop-blur">
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
        <NavLink href="/">Map</NavLink>
        {user && <NavLink href="/saved">Saved</NavLink>}
        {user && <NavLink href="/contribute">Contribute</NavLink>}
        <SoundToggle />

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
            <InfoTip align="right">
              Searching and the map are free and need no account. Sign in only
              to save places you find and to submit new haunted spots to the
              map. Your saved places then follow you across devices.
            </InfoTip>
            <NavLink href="/login">Sign in</NavLink>
            <Link
              href="/register"
              onClick={() => spookyAudio.playEffect("click")}
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

function SoundToggle() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void spookyAudio.toggle().then((nowOn) => {
          setOn(nowOn);
          if (nowOn) spookyAudio.playEffect("chime");
        });
      }}
      aria-label={on ? "Turn ambient sound off" : "Turn ambient sound on"}
      title={on ? "Ambient sound on" : "Ambient sound off"}
      className={
        "ml-1 rounded p-1.5 transition " +
        (on ? "text-teal-bright" : "text-bone-400 hover:text-bone-200")
      }
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H2v6h4l5 4z" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="M22 9l-6 6M16 9l6 6" />
        )}
      </svg>
    </button>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={() => spookyAudio.playEffect("click")}
      className="rounded px-2.5 py-1.5 text-bone-300 transition hover:bg-ink-700 hover:text-bone-200"
    >
      {children}
    </Link>
  );
}
