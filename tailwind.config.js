/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090909',
        card: '#151515',
        card2: '#202020',
        line: '#2d2d2d',
        muted: '#8e8e8e',
        // set at runtime from the chosen theme (src/lib/theme.ts)
        accent: { DEFAULT: 'rgb(var(--accent) / <alpha-value>)', soft: 'rgb(var(--accent) / 0.16)' },
        ink: 'rgb(var(--ink) / <alpha-value>)',
        done: { DEFAULT: '#22c55e', soft: '#173023' },
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
