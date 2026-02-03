import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f7f7f2",
        fg: "#1c1f1a",
        accent: "#0f766e",
        danger: "#b42318",
        warning: "#b54708"
      }
    }
  },
  plugins: []
};

export default config;
