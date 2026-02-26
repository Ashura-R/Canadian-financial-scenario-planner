import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          surface2: 'var(--app-surface2)',
          border: 'var(--app-border)',
          border2: 'var(--app-border2)',
          text: 'var(--app-text)',
          text2: 'var(--app-text2)',
          text3: 'var(--app-text3)',
          text4: 'var(--app-text4)',
          accent: 'var(--app-accent)',
          'accent-hover': 'var(--app-accent-hover)',
          'accent-light': 'var(--app-accent-light)',
          positive: 'var(--app-positive)',
          negative: 'var(--app-negative)',
          warning: 'var(--app-warning)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
