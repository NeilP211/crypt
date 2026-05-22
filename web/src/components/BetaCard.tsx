"use client";

import { spookyAudio } from "@/lib/audio";

// Sidebar footer: a wrapped mummy, a beta notice, and a feedback mailto.
// Uses mt-auto so it settles into the bottom of the sidebar column.
export function BetaCard() {
  return (
    <div className="mt-auto overflow-hidden rounded-lg border border-ink-700 bg-gradient-to-b from-ink-900 to-ink-950">
      <div className="flex flex-col items-center px-4 pt-4">
        <MummyGlyph />
        <p className="mt-1 font-display text-xl tracking-wide text-gold">Beta testing</p>
        <p className="mt-0.5 text-center text-[11px] text-bone-400">
          Crypt is freshly unwrapped and still in beta.
        </p>
      </div>
      <div className="border-t border-ink-700/70 p-4">
        <p className="text-xs leading-relaxed text-bone-300">
          Spot a bug, a bad pin, or have an idea to make the crypt better? I read
          every message.
        </p>
        <a
          href="mailto:neilpatel1623@gmail.com?subject=Crypt%20beta%20feedback"
          onClick={() => spookyAudio.playEffect("chime")}
          className="mt-3 flex items-center justify-center gap-2 rounded-md border border-crimson/50 bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson transition hover:bg-crimson/20 hover:text-crimson-bright"
        >
          Send a suggestion
        </a>
        <p className="mt-2 text-center font-mono text-[10px] text-bone-400">
          neilpatel1623@gmail.com
        </p>
      </div>
    </div>
  );
}

function MummyGlyph() {
  const bodyPath =
    "M40 5 C27 5 21 14 21 27 L21 84 C21 91 26 95 33 95 L47 95 C54 95 59 91 59 84 L59 27 C59 14 53 5 40 5 Z";
  return (
    <svg width="92" height="116" viewBox="0 0 80 100" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="mummyBody">
          <path d={bodyPath} />
        </clipPath>
        <radialGradient id="mummyGrime" cx="50%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#dccca6" />
          <stop offset="100%" stopColor="#9d8e6c" />
        </radialGradient>
        <filter id="eyeGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="40" cy="52" rx="33" ry="45" fill="#7a1d2b" opacity="0.18" />

      <path d={bodyPath} fill="url(#mummyGrime)" />

      <g clipPath="url(#mummyBody)">
        <g stroke="#a8966f" strokeWidth="2.2" opacity="0.85">
          {Array.from({ length: 16 }).map((_, i) => {
            const y = 6 + i * 6;
            return <line key={`a${i}`} x1="12" y1={y} x2="68" y2={y - 7} />;
          })}
        </g>
        <g stroke="#7d6e4e" strokeWidth="1" opacity="0.55">
          {Array.from({ length: 16 }).map((_, i) => {
            const y = 9 + i * 6;
            return <line key={`b${i}`} x1="12" y1={y} x2="68" y2={y - 7} />;
          })}
        </g>
        <rect x="16" y="27" width="48" height="11" fill="#5b4f39" opacity="0.45" />
      </g>

      <g filter="url(#eyeGlow)">
        <ellipse cx="33" cy="33" rx="3.4" ry="2.1" fill="#ff5d73" transform="rotate(-12 33 33)" />
        <ellipse cx="47" cy="33" rx="3.4" ry="2.1" fill="#ff5d73" transform="rotate(12 47 33)" />
      </g>

      <path
        d="M44 94 q5 6 0 11 q-3 3 0 7"
        stroke="#cdbf9c"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
