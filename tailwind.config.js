/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Crimson Phantom Aesthetic
        background: '#050505',
        foreground: '#ffffff',
        primary: {
          DEFAULT: '#dc143c',
          light: '#ff1a40',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#1a1a2e',
          foreground: '#fafafa',
        },
        muted: {
          DEFAULT: '#1a1a2e',
          foreground: '#b3b3b3',
        },
        accent: {
          DEFAULT: '#dc143c',
          foreground: '#ffffff',
        },
        border: 'rgba(255, 255, 255, 0.1)',
        input: 'rgba(255, 255, 255, 0.12)',
        ring: '#dc143c',
        crimson: '#dc143c',
        'crimson-light': '#ff1a40',
        teal: '#0d9488',
        'teal-light': '#14b8a6',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
      },
      backdropBlur: {
        'glass': '24px',
        'glass-strong': '32px',
      },
      boxShadow: {
        'glow-crimson': '0 0 20px rgba(220, 20, 60, 0.4), 0 0 60px rgba(220, 20, 60, 0.1)',
        'glow-crimson-sm': '0 0 12px rgba(220, 20, 60, 0.3), 0 0 30px rgba(220, 20, 60, 0.08)',
        'glow-teal': '0 0 20px rgba(13, 148, 136, 0.4), 0 0 60px rgba(13, 148, 136, 0.1)',
        'inner-glass': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(220, 20, 60, 0.4), 0 0 60px rgba(220, 20, 60, 0.1)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(220, 20, 60, 0.55), 0 0 80px rgba(220, 20, 60, 0.2)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-crimson': 'linear-gradient(135deg, #dc143c, #ff1a40)',
        'gradient-teal': 'linear-gradient(135deg, #0d9488, #14b8a6)',
        'mesh-crimson': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(220, 20, 60, 0.15), transparent), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(220, 20, 60, 0.08), transparent), radial-gradient(ellipse 40% 30% at 20% 80%, rgba(255, 26, 64, 0.05), transparent)',
      },
    },
  },
  plugins: [],
}