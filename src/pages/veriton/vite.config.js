import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '~': path.resolve(__dirname, '../..'),
      '@/components': path.resolve(__dirname, '../../components'),
      '@/lib': path.resolve(__dirname, '../../lib'),
      '@/components/TiltCard': path.resolve(__dirname, '../components/TiltCard.jsx'),
      '@/components/GlowChip': path.resolve(__dirname, '../components/GlowChip.jsx'),
      '@/components/ExplodingButton': path.resolve(__dirname, '../components/ExplodingButton.jsx'),
      '@/components/WaveformVisualizer': path.resolve(__dirname, '../components/WaveformVisualizer.jsx'),
      '@/components/UserNotRegisteredError': path.resolve(__dirname, '../components/UserNotRegisteredError.jsx'),
      '@/lib/veritonDb': path.resolve(__dirname, '../../lib/veritonDb.ts'),
    },
  },
});
