import type { Config } from "tailwindcss";

const config: Config = {
  // Sistema interno Cestacorp: só tema claro (evita inconsistência quando SO está em dark)
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "#EEF2FF",
          100: "#E0E7FF",
          500: "#3B4CCA",
          600: "#2A3DB8",
          700: "#1E3A8A",
          800: "#1A2F6B",
          900: "#152355",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          50: "#F7FEE7",
          100: "#ECFCCB",
          500: "#84CC16",
          600: "#65A30D",
          700: "#4D7C0F",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        cestacorp: {
          /* Azul mais leve, moderno — antes #1E3A8A (navy pesado) */
          blue: "#1F4FC4",
          blueDark: "#1A3FA0",
          green: "#84CC16",
          greenDark: "#65A30D",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
