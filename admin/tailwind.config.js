/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // "On-air" amber accent + warm neutral ink palette.
        signal: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        ink: {
          0: '#ffffff',
          50: '#f7f7f6',
          100: '#eeedea',
          200: '#dcdad4',
          300: '#bbb8ae',
          400: '#8f8c81',
          500: '#6b6860',
          600: '#4d4a44',
          700: '#36342f',
          800: '#23211e',
          850: '#1a1916',
          900: '#121110',
          950: '#0b0a09',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(18,17,16,.04), 0 4px 16px -8px rgba(18,17,16,.12)',
        pop: '0 12px 40px -12px rgba(18,17,16,.35)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'none' } },
        'slide-in': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'none' } },
        equalize: { '0%,100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: {
        'fade-up': 'fade-up .4s cubic-bezier(.2,.7,.3,1) both',
        'scale-in': 'scale-in .18s cubic-bezier(.2,.7,.3,1) both',
        'slide-in': 'slide-in .28s cubic-bezier(.2,.7,.3,1) both',
      },
    },
  },
  plugins: [],
};
