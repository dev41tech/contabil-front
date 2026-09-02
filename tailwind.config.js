/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---- nomes do shadcn, já apontando para a paleta do Connect ----
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        // ---- tokens do Connect que o shadcn não tem ----
        // Todos em hsl(var(--x)), então bg-success/10 e border-danger/30
        // funcionam e trocam de tema sozinhos.
        canvas: "hsl(var(--canvas))",
        sidebar: "hsl(var(--sidebar))",
        topbar: "hsl(var(--topbar))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          hover: "hsl(var(--surface-hover))",
          elevated: "hsl(var(--surface-elevated))",
        },
        "input-bg": "hsl(var(--input-bg))",
        "table-header": "hsl(var(--table-header-bg))",
        "border-strong": "hsl(var(--border-strong))",
        "fg-secondary": "hsl(var(--fg-secondary))",
        brand: {
          DEFAULT: "hsl(var(--brand))",
          hover: "hsl(var(--brand-hover))",
        },
        "on-brand": "hsl(var(--on-brand))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        info: "hsl(var(--info))",
      },

      // Três degraus, e só — igual ao DS. rounded-md (10px) é o controle,
      // rounded-lg (16px) é o card. Não usar rounded-xl/2xl: caem no default
      // do Tailwind, fora desta escala.
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },

      // Escala tipográfica de 9 degraus do DS (11·12·13·14·15·16·18·22·30),
      // mapeada nos nomes que as telas já usam, seguindo a tabela de
      // arredondamento do próprio globals.css. text-sm passa a ser 13px — o
      // tamanho real da UI densa deste app — e text-base 15px, a leitura.
      fontSize: {
        xs: ["11px", { lineHeight: "1.45" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["15px", { lineHeight: "1.5" }],
        lg: ["18px", { lineHeight: "1.4" }],
        xl: ["22px", { lineHeight: "1.3" }],
        "2xl": ["22px", { lineHeight: "1.3" }],
        "3xl": ["30px", { lineHeight: "1.2" }],
        "4xl": ["30px", { lineHeight: "1.2" }],
        // degraus nomeados, para código novo
        badge: ["12px", { lineHeight: "1.4" }],
        label: ["14px", { lineHeight: "1.45" }],
        "card-title": ["16px", { lineHeight: "1.4" }],
      },

      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Consolas", "monospace"],
        display: ['"Space Grotesk"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
      },

      boxShadow: {
        sm: "0 2px 8px hsl(var(--foreground) / 0.07)",
        lg: "0 20px 48px hsl(var(--foreground) / 0.14)",
      },
    },
  },
  plugins: [],
}
