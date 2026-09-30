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
        brand: {
          orange: "#E35824",
          gold: "#F5AF28",
          charcoal: "#2B2D31",
          navy: "#121826",
        },
      },
    },
  },
  plugins: [],
};
export default config;
