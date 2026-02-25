import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0a0d14',
        surface: '#111827',
        surface2: '#1f2937',
        border: '#1e2d3d',
        border2: '#374151',
        accent: '#3b82f6',
        positive: '#10b981',
        negative: '#ef4444',
        textPrimary: '#f9fafb',
        textSecondary: '#9ca3af',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
