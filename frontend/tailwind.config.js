/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080b16',
          900: '#0d1122',
          800: '#141a33',
          700: '#1d2547',
          600: '#2b3563',
        },
        glow: {
          400: '#7c8cff',
          500: '#5f6ffa',
          600: '#4a55d6',
        },
        mint: {
          400: '#34e1a4',
          500: '#17c98c',
        },
        amber: {
          400: '#ffc453',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 40px -24px rgba(4, 8, 24, 0.9)',
        glow: '0 0 0 1px rgba(124, 140, 255, 0.35), 0 12px 40px -18px rgba(124, 140, 255, 0.65)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.35s ease-out both',
        pulseRing: 'pulseRing 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
