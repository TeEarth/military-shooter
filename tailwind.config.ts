import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        military: {
          dark: "#1a1a2e",
          darker: "#0f0f1a",
          green: "#2d5a27",
          olive: "#4a5c2a",
          tan: "#c5a97d",
          steel: "#4a4e69",
          danger: "#c0392b",
          gold: "#f39c12",
          diamond: "#3498db",
        },
      },
      fontFamily: {
        military: ["'Orbitron'", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
