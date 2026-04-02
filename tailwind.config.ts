import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark premium base colors (near-black backgrounds)
        dark: {
          900: "#0a0a0a", // Deepest black for main backgrounds
          800: "#121212", // Secondary surfaces
          700: "#1a1a1a", // Cards and components
          600: "#242424", // Borders and dividers
        },
        // Brand accent - electric blue (bold, premium)
        brand: {
          500: "#3B82F6", // Primary electric blue
          400: "#60A5FA", // Lighter for hover effects
          300: "#93C5FD", // Subtle accents
        },
        // Neutral grays with warmth
        neutral: {
          100: "#F5F5F5", // Text on dark
          200: "#D4D4D4", // Secondary text
          300: "#A3A3A3", // Muted text
        },
      },
      fontFamily: {
        display: ["Sora", "Inter", "system-ui"],
        body: ["Inter", "system-ui"],
      },
      fontSize: {
        "display-xl": [
          "5.5rem",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
          },
        ],
        "display-lg": [
          "4rem",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
          },
        ],
        "display-md": [
          "3rem",
          {
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
          },
        ],
      },
      spacing: {
        18: "4.5rem",
        26: "6.5rem",
        34: "8.5rem",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(0, 0, 0, 0.3)",
        "glow": "0 0 40px rgba(59, 130, 246, 0.3)",
      },
      borderRadius: {
        "premium-xl": "1rem",
        "premium-2xl": "1.5rem",
      },
      backdropBlur: {
        premium: "12px",
      },
      animation: {
        "gradient-shift": "gradient 8s ease infinite",
      },
      keyframes: {
        gradient: {
          "0%, 100%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
