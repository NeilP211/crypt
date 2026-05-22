"use client";

// Faint apparitions — ghosts, bats, and a witch — drifting across the
// viewport. They scurry away from the cursor when it gets close. The overlay
// is pointer-events-none so it never blocks the UI, and it hides itself for
// users who prefer reduced motion (see globals.css).

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

function Ghost() {
  return (
    <svg width="44" height="54" viewBox="0 0 44 54">
      <path d="M4 28a18 18 0 0 1 36 0v22l-6-5-6 5-6-5-6 5-6-5z" fill="#bfe3da" />
      <circle cx="16" cy="25" r="3" fill="#0a090b" />
      <circle cx="28" cy="25" r="3" fill="#0a090b" />
      <ellipse cx="22" cy="33" rx="3.5" ry="5" fill="#0a090b" />
    </svg>
  );
}

function Bat() {
  return (
    <svg width="40" height="18" viewBox="0 0 40 18">
      <path
        d="M20 6 L26 2 L25 8 L32 6 L38 10 L30 11 L24 14 L20 10 L16 14 L10 11 L2 10 L8 6 L15 8 L14 2 Z"
        fill="#5a4a55"
      />
    </svg>
  );
}

function Witch() {
  return (
    <svg width="72" height="40" viewBox="0 0 72 40">
      <g fill="#6b5a78">
        <rect x="4" y="23" width="48" height="2.5" transform="rotate(-9 4 23)" />
        <polygon points="2,27 15,20 13,31" />
        <path d="M40 24 q3 -11 9 -10 q6 1 5 8 q-1 6 -8 7 q-4 1 -6 -5 z" />
        <polygon points="45,7 58,16 40,16" />
        <ellipse cx="49" cy="16" rx="12" ry="2" />
      </g>
    </svg>
  );
}

interface Spook {
  el: React.ReactNode;
  top: string;
  drift: "left" | "right";
  duration: number;
  delay: number;
  opacity: number;
  bob?: number;
}

const SPOOKS: Spook[] = [
  { el: <Ghost />, top: "16%", drift: "right", duration: 44, delay: 0, opacity: 0.2, bob: 5 },
  { el: <Ghost />, top: "64%", drift: "left", duration: 56, delay: 12, opacity: 0.15, bob: 6 },
  { el: <Witch />, top: "9%", drift: "left", duration: 30, delay: 7, opacity: 0.24 },
  { el: <Bat />, top: "28%", drift: "left", duration: 19, delay: 2, opacity: 0.3, bob: 3 },
  { el: <Bat />, top: "46%", drift: "right", duration: 16, delay: 9, opacity: 0.28, bob: 2.5 },
];

const REPEL_RADIUS = 130; // px
const REPEL_STRENGTH = 110; // px max push

export function SpookyOverlay() {
  const repelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const offsets = useRef(SPOOKS.map(() => ({ x: 0, y: 0 })));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      const m = mouse.current;
      repelRefs.current.forEach((el, i) => {
        if (!el) return;
        const off = offsets.current[i];
        let tx = 0;
        let ty = 0;
        if (m) {
          const rect = el.getBoundingClientRect();
          // Center without the current repulsion offset, so it settles.
          const cx = rect.left + rect.width / 2 - off.x;
          const cy = rect.top + rect.height / 2 - off.y;
          const dx = cx - m.x;
          const dy = cy - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < REPEL_RADIUS && dist > 0.01) {
            const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
            tx = (dx / dist) * force;
            ty = (dy / dist) * force;
          }
        }
        // Quick to flee, slow to drift back.
        const ease = tx || ty ? 0.3 : 0.08;
        off.x += (tx - off.x) * ease;
        off.y += (ty - off.y) * ease;
        el.style.transform = `translate(${off.x.toFixed(1)}px, ${off.y.toFixed(1)}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {SPOOKS.map((s, i) => {
        const outer: CSSProperties = {
          top: s.top,
          opacity: s.opacity,
          animation: `spook-drift-${s.drift} ${s.duration}s linear ${s.delay}s infinite`,
        };
        const inner: CSSProperties = s.bob
          ? { animation: `spook-bob ${s.bob}s ease-in-out infinite` }
          : {};
        return (
          <div key={i} className="spook" style={outer}>
            <div
              ref={(el) => {
                repelRefs.current[i] = el;
              }}
            >
              <div style={inner}>{s.el}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
