import type { Config } from "tailwindcss";

// Palette derived from the Crypt brand icon: a gold glowing frame, crimson
// crystal, and a teal weapon glow on warm gunmetal-black.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm near-black base + gunmetal frame tones.
        ink: {
          950: "#0a090b",
          900: "#121013",
          800: "#1b181d",
          700: "#272229",
          600: "#383139",
        },
        // Primary accent — the icon's gold border glow.
        gold: {
          DEFAULT: "#e6b84e",
          bright: "#f5d27a",
          dim: "#9b7a2e",
        },
        // Secondary accent — the crimson crystal / "V" badge.
        crimson: {
          DEFAULT: "#bf2f43",
          bright: "#e0455a",
          dim: "#7d1d2b",
        },
        // Tertiary accent — the teal weapon glow.
        teal: {
          DEFAULT: "#36b39a",
          bright: "#54d4ba",
        },
        // Warm off-white text scale.
        bone: {
          400: "#9a9285",
          300: "#cfc8ba",
          200: "#ece6da",
        },
        verified: "#36b39a",
        demolished: "#bf2f43",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Cinzel", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(230,184,78,0.25), 0 0 18px -4px rgba(230,184,78,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
