import type { ReactNode } from "react";

// A small "?" badge that reveals an explanation on hover.
export function InfoTip({
  children,
  side = "bottom",
  align = "center",
}: {
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "right";
}) {
  const vertical = side === "top" ? "bottom-6" : "top-6";
  const horizontal =
    align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex align-middle">
      <span
        role="img"
        aria-label="More information"
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-ink-600 text-[10px] leading-none text-bone-400 transition group-hover:border-teal group-hover:text-teal-bright"
      >
        ?
      </span>
      <span
        className={`pointer-events-none absolute ${vertical} ${horizontal} z-50 w-60 rounded-lg border border-ink-700 bg-ink-800 p-3 text-[11px] font-normal not-italic leading-relaxed text-bone-200 opacity-0 shadow-xl transition duration-150 group-hover:opacity-100`}
      >
        {children}
      </span>
    </span>
  );
}
