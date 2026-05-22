"use client";

// Faint apparitions — ghosts, bats, and a witch — drift across the viewport.
// When the cursor gets close they panic and bolt off-screen, then reappear
// from an edge a few seconds later. Pointer-events-none so they never block
// the UI; disabled entirely under prefers-reduced-motion.

import { useEffect, useRef } from "react";

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

const KINDS = { ghost: Ghost, bat: Bat, witch: Witch } as const;

interface SpookDef {
  kind: keyof typeof KINDS;
  w: number;
  h: number;
  opacity: number;
  speed: number; // px/s drift
}

const DEFS: SpookDef[] = [
  { kind: "ghost", w: 44, h: 54, opacity: 0.2, speed: 34 },
  { kind: "ghost", w: 44, h: 54, opacity: 0.15, speed: 26 },
  { kind: "witch", w: 72, h: 40, opacity: 0.24, speed: 62 },
  { kind: "bat", w: 40, h: 18, opacity: 0.3, speed: 95 },
  { kind: "bat", w: 40, h: 18, opacity: 0.28, speed: 80 },
];

const FLEE_RADIUS = 150;
const FLEE_SPEED = 680; // px/s when scurrying off-screen
const BOB_AMP = 9;
const BOB_FREQ = 1.8;

interface State {
  x: number;
  y: number;
  baseY: number;
  dir: 1 | -1;
  fleeing: boolean;
  dead: boolean;
  respawnAt: number;
  phase: number;
}

export function SpookyOverlay() {
  const elRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const spawn = (def: SpookDef, st?: State): State => {
      const dir: 1 | -1 = st ? ((-st.dir) as 1 | -1) : Math.random() < 0.5 ? 1 : -1;
      const baseY = 0.05 * H() + Math.random() * 0.7 * H();
      const x = dir === 1 ? -def.w - 20 : W() + 20;
      return { x, y: baseY, baseY, dir, fleeing: false, dead: false, respawnAt: 0, phase: Math.random() * Math.PI * 2 };
    };

    const states: State[] = DEFS.map((d) => spawn(d));
    // stagger initial entry across the width
    states.forEach((s, i) => {
      s.x = (W() / DEFS.length) * i;
      s.dir = i % 2 === 0 ? 1 : -1;
    });

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);

    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = mouse.current;

      states.forEach((s, i) => {
        const def = DEFS[i];
        const el = elRefs.current[i];
        if (!el) return;

        if (s.dead) {
          if (now >= s.respawnAt) Object.assign(s, spawn(def, s));
          else {
            el.style.opacity = "0";
            return;
          }
        }

        const cx = s.x + def.w / 2;
        const cy = s.y + def.h / 2;
        if (m && !s.fleeing) {
          if (Math.hypot(cx - m.x, cy - m.y) < FLEE_RADIUS) s.fleeing = true;
        }

        if (s.fleeing) {
          let ax = s.dir;
          let ay = 0;
          if (m) {
            const dx = cx - m.x;
            const dy = cy - m.y;
            const d = Math.hypot(dx, dy) || 1;
            ax = dx / d;
            ay = dy / d;
          }
          s.x += ax * FLEE_SPEED * dt;
          s.y += ay * FLEE_SPEED * dt;
        } else {
          s.x += s.dir * def.speed * dt;
          s.y = s.baseY + Math.sin(now / 1000 * BOB_FREQ + s.phase) * BOB_AMP;
        }

        if (s.x < -def.w - 160 || s.x > W() + 160 || s.y < -def.h - 160 || s.y > H() + 160) {
          s.dead = true;
          s.respawnAt = now + 2500 + Math.random() * 5000;
        }

        el.style.opacity = String(def.opacity);
        el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
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
      {DEFS.map((d, i) => {
        const Sprite = KINDS[d.kind];
        return (
          <div
            key={i}
            ref={(el) => {
              elRefs.current[i] = el;
            }}
            style={{ position: "absolute", left: 0, top: 0, opacity: 0, willChange: "transform" }}
          >
            <Sprite />
          </div>
        );
      })}
    </div>
  );
}
