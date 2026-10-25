/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // surfaces and accents come from the chosen theme (src/lib/theme.ts)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        card2: 'rgb(var(--card2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        muted: '#8e8e8e',
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', soft: 'rgb(var(--accent) / 0.16)' },
        accent2: 'rgb(var(--accent2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        done: { DEFAULT: 'rgb(var(--done) / <alpha-value>)', soft: 'rgb(var(--done-soft) / <alpha-value>)' },
        warn: '#f5a524',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'Impact', '"Arial Narrow"', 'sans-serif'],
      },
      // sharper, less pillowy corners than Hevy
      borderRadius: {
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.625rem',
        '3xl': '1rem',
      },
    },
  },
  plugins: [],
};
