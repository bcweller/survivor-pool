import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gridiron: {
          900: '#0b1120',
          800: '#111827',
          700: '#1f2937',
        },
        accent: {
          DEFAULT: '#22c55e',
          dark: '#16a34a',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
