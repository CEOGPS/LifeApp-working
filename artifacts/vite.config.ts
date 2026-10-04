import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { lifeosComputerStore } from './lifeosStorePlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const nvidiaKey = (env.NVIDIA_API_KEY || env.NVAPI_KEY || '').trim();
  return {
    plugins: [
      react(),
      tailwindcss(),
      lifeosComputerStore(),
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PROJECT_URL || 'https://mhvcdstgkyplhzjptgfr.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || ''),
      'import.meta.env.VITE_WORKER_URL': JSON.stringify(env.VITE_WORKER_URL || 'https://lifeos1-api.ceogps.workers.dev'),
      'import.meta.env.VITE_REPLICATE_API_KEY': JSON.stringify(env.VITE_REPLICATE_API_KEY || env.REPLICATE_API_KEY || ''),
      'import.meta.env.VITE_STABILITY_AI_API_KEY': JSON.stringify(env.VITE_STABILITY_AI_API_KEY || env.STABILITY_AI_API_KEY || ''),
      'import.meta.env.VITE_ELEVENLABS_API_KEY': JSON.stringify(env.VITE_ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY || ''),
      'import.meta.env.VITE_LUMA_API_KEY': JSON.stringify(env.VITE_LUMA_API_KEY || env.LUMA_API_KEY || ''),
      'import.meta.env.VITE_DID_API_KEY': JSON.stringify(env.VITE_DID_API_KEY || env.DID_API_KEY || ''),
      'import.meta.env.VITE_HUGGINGFACE_API_KEY': JSON.stringify(env.VITE_HUGGINGFACE_API_KEY || env.HUGGINGFACE_API_KEY || env.HF_TOKEN || ''),
      'import.meta.env.VITE_RUNWAY_API_KEY': JSON.stringify(env.VITE_RUNWAY_API_KEY || env.RUNWAY_API_KEY || ''),
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || ''),
      'import.meta.env.VITE_NVIDIA_API_KEY': JSON.stringify(env.VITE_NVIDIA_API_KEY || env.NVIDIA_API_KEY || env.NVAPI_KEY || ''),
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'zustand'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        '~': path.resolve(__dirname, './'),
      },
    },
    base: './',
    build: {
      rollupOptions: {
        external: ['@mlc-ai/web-llm'],
      },
      minify: 'esbuild',
      target: 'es2020',
    },
    server: {
      port: 3000,
      watch: {
        ignored: [
          '**/kokoro-env/**',
          '**/.venv*/**',
          '**/venv/**',
          '**/.build-fix-backup/**',
          '**/*.log',
          '**/*.log.*',
          '**/*.err',
          '**/*.wav',
          '**/__pycache__/**',
          '**/*.py',
          '**/*.pyc',
          '**/*.db',
          '**/*.sqlite*',
          '**/.lifeos/**',
        ],
      },
      proxy: {
        '/nvidia-llm': {
          target: 'https://integrate.api.nvidia.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) => p.replace(/^\/nvidia-llm/, ''),
          headers: nvidiaKey ? { Authorization: `Bearer ${nvidiaKey}` } : {},
        },
        '/nvidia-genai': {
          target: 'https://ai.api.nvidia.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) => p.replace(/^\/nvidia-genai/, ''),
          headers: nvidiaKey ? { Authorization: `Bearer ${nvidiaKey}`, Accept: 'application/json' } : {},
        },
        '/api': {
          target: env.VITE_WORKER_URL || env.VITE_CLOUDFLARE_WORKER_URL || 'https://lifeos1-api.ceogps.workers.dev',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
