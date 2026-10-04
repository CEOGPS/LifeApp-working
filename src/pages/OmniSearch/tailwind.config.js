/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#000000', secondary: '#141414', tertiary: '#1a1a1a' },
        primary: { DEFAULT: '#ff000d', hover: '#ff3338', dark: '#800000', darker: '#4b0f0f' },
        accent: { glow: '#ff3338', metallic: '#a9a9a9' },
        card: { DEFAULT: '#141414', foreground: '#f0f0f0' },
        muted: { DEFAULT: '#4d4d4d', foreground: '#7c7c7c' },
        success: '#00c896',
        warning: '#f59e0b',
        danger: '#ef4444',
        border: '#333333',
        input: '#262626',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.5s infinite',
        'agent-pulse': 'agentPulse 2s ease-in-out infinite',
        'agent-float': 'agentFloat 3s ease-in-out infinite',
        'dot-blink': 'dotBlink 1.5s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px #ff000d' },
          '50%': { opacity: '0.6', boxShadow: '0 0 16px #ff000d, 0 0 32px rgba(255,0,13,0.4)' },
        },
        agentPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,0,13,0.4)' },
          '50%': { boxShadow: '0 0 60px rgba(255,0,13,0.9)' },
        },
        agentFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        dotBlink: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
