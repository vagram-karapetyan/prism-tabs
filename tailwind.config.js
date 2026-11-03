/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './popup.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        prism: {
          bg: 'var(--prism-bg)',
          surface: 'var(--prism-surface)',
          card: 'var(--prism-card)',
          border: 'var(--prism-border)',
          accent: 'var(--prism-accent)',
        },
      },
      animation: {
        'prism-beam': 'prismBeam 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'shimmer': 'shimmer 1.8s linear infinite',
        'fade-in': 'fadeIn 0.22s ease-out forwards',
      },
      keyframes: {
        prismBeam: {
          '0%': { transform: 'translateX(-100%) scaleX(0.6)', opacity: '0.2' },
          '50%': { transform: 'translateX(0%) scaleX(1.1)', opacity: '1' },
          '100%': { transform: 'translateX(100%) scaleX(0.6)', opacity: '0.2' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
