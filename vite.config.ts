import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import net from 'net';

function erebusBackend() {
  let child: ChildProcess | null = null;
  return {
    name: 'erebus-backend',
    configureServer() {
      const port = 8000;
      const socket = net.connect({ port, host: '127.0.0.1' });
      socket.on('connect', () => socket.end());
      socket.on('error', () => {
        const root = process.cwd();
        const main = path.resolve(root, 'src/lib/agents/advanced_agent/runtime/main.py');
        const venvPy = process.platform === 'win32'
          ? path.resolve(root, 'src/lib/agents/advanced_agent/runtime/.venv/Scripts/python.exe')
          : path.resolve(root, 'src/lib/agents/advanced_agent/runtime/.venv/bin/python');
        const python = fs.existsSync(venvPy) ? venvPy : (process.platform === 'win32' ? 'python' : 'python3');
        child = spawn(python, [main], {
          cwd: root,
          stdio: 'inherit',
          env: { ...process.env, FASTAPI_PORT: String(port) },
        });
      });
    },
    closeBundle() {
      child?.kill();
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const nvidiaKey = (env.NVIDIA_API_KEY || env.NVAPI_KEY || '').trim();
  return {
    plugins: [
      react(),
      tailwindcss(),
      erebusBackend(),
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PROJECT_URL || 'https://mhvcdstgkyplhzjptgfr.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || ''),
      'import.meta.env.VITE_WORKER_URL': JSON.stringify(env.VITE_WORKER_URL || 'https://lifeos1-api.ceogps.workers.dev'),
      // Creator Studio / ErebusMedia: map server .env keys into VITE_ aliases (dev + build).
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
      // PATCH (erebus-dock-redesign): src/pages/OmniSearch has its own node_modules
      // (React + zustand). Vite prebundled "zustand" from there, giving the app a
      // second React instance ("Invalid hook call"). Force one copy from the root.
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
        // Prevent non-frontend files (Python venvs, backups, logs, audio) from
        // triggering Tailwind/Vite full page reloads.
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
          '**/model_scores.json',
          '**/cowork_notes.json',
          '**/advanced_agent/runtime/**',
        ],
      },
      proxy: {
        // PATCH (erebus-dock-redesign): NVIDIA fallback for the Erebus dock
        // (Chris's stack: Erebus backend -> Ollama -> NVIDIA). The key is read
        // server-side from .env (NVIDIA_API_KEY / NVAPI_KEY) and injected by the
        // dev server; it never reaches the browser bundle. Dev server only.
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