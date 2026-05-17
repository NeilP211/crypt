import type { Config } from "tailwindcss";

// A dark "field-survey" palette: near-black panels, faint slate text, and a
// rust/amber accent that suits the urban-exploration subject.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0b0d",
          900: "#101216",
          800: "#171a20",
          700: "#21252e",
          600: "#2c313c",
        },
        rust: {
          DEFAULT: "#c9772f",
          bright: "#e4944a",
          dim: "#8a5320",
        },
        haze: {
          400: "#8b93a3",
          300: "#aab1bf",
          200: "#c9ced8",
        },
        verified: "#4ea36b",
        demolished: "#b14a4a",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
