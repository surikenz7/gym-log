/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        card: '#16171a',
        card2: '#1f2125',
        line: '#2a2c31',
        muted: '#8b8f98',
        accent: { DEFAULT: '#2f7cf6', soft: '#2f7cf622' },
        done: { DEFAULT: '#22c55e', soft: '#173023' },
        warn: '#f5a524',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
