/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        'bg-primary': '#000000',
        'bg-secondary': '#0a0a0a',
        'bg-card': '#18181b',
        'bg-card-hover': '#27272a',
        'bg-elevated': '#27272a',

        // Text colors
        'text-primary': '#fafafa',
        'text-secondary': '#a1a1aa',
        'text-muted': '#71717a',

        // Accent colors
        'accent-blue': '#3b82f6',
        'accent-sky': '#00bfff',
        'accent-green': '#22c55e',
        'accent-yellow': '#f59e0b',
        'accent-amber': '#f59e0b',
        'accent-red': '#ef4444',
        'accent-purple': '#a855f7',

        // State colors
        'state-active': '#22c55e',
        'state-processing': '#3b82f6',
        'state-idle': '#f59e0b',
        'state-background': '#71717a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.72s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'aura-pulse': 'auraPulse 2s ease-in-out infinite',
        'lightning-flash': 'lightningFlash 100ms ease-out forwards',
      },
      keyframes: {
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(40px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        auraPulse: {
          '0%, 100%': {
            opacity: '0.7',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.08)',
          },
        },
        lightningFlash: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.8)',
          },
          '30%': {
            opacity: '1',
            transform: 'scale(1.1)',
          },
          '100%': {
            opacity: '0',
            transform: 'scale(1)',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
