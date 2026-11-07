import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#eef2f8", 100: "#d6dfee", 600: "#1d3f73", 700: "#142f5a", 800: "#0f2347", 900: "#0a1a36" },
        teal: { 50: "#e8f7f6", 100: "#c5ece9", 500: "#14a59b", 600: "#0e8a82", 700: "#0b6e68" },
      },
    },
  },
  plugins: [],
};
export default config;
