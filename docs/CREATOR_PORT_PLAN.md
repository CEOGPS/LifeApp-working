# Creator Port Plan: Base44 "Creator" app -> LifeOS (read-only analysis, 2026-09-29; revised same day)

> **Revision (2026-09-29):** Chris rejected the cloud AI providers (Gemini, Luma, Replicate, etc.). Creator now runs only on **Erebus, Kranos, Ollama and NVIDIA** (Sections 3c-3g, 5, 6). The previous cloud version is saved as `docs/CREATOR_PORT_PLAN.cloud.bak.md`.

Scope: bring Chris's real Creator app (Base44 export) into LifeOS at `/creator`. This is a plan only. No app code, DB, or worker changes were made to produce it.
This plan supersedes the scope of `docs/CREATOR_CONDENSE_PLAN.md`. That plan's housekeeping items (sidebar label, dead route, dead placeholder) are folded into Phase 0 here.

Sources inspected:
- Export: `creator-base44.zip` (export-report.json: exported 2026-07-18, 106 files, 0 assets, 1 harmless warning about a cross-origin preview iframe scan). Feature code is about 2,500 lines excluding auth; about 3,700 lines including auth/boilerplate.
- `src/api/base44Client.js` and every page are a blank stub (`globalThis.__B44_DB__ || {...}` returning empty values). The real backend behavior was reconstructed from each call site (below).
- LifeOS: `D:\dev\LifeApp` (src, worker, .env names, `wrangler secret list` names), Supabase LifeOS1 (`mhvcdstgkyplhzjptgfr`) table list and columns (read-only).
- Revision: Agent Dock / ErebusCore / Kranos / UnifiedAgentCore / Erebus FastAPI (`advanced_agent/runtime/main.py`) / browser-agent code, `.env` + worker secret names, Kranos3 machine state (Ollama install + models, `nvidia-smi`, listening ports, cloudflared, local SD installs).

---

## 1. Feature inventory (from the export)

Base44 calls used: `entities.Creation.{list,filter,create,delete}`, `entities.Project.{list,get,create,delete}`, `integrations.Core.InvokeLLM` (text, plus vision via `file_urls`), `GenerateImage` (with optional `existing_image_urls` references), `GenerateVideo` (`prompt`, `duration`), `TranscribeAudio` (`audio_url`), `UploadFile`.

| Page (lines) | What it does | Backend calls / behavior needed |
|---|---|---|
| **Studio.jsx** (454), route `/` | Chat-style unified studio. Mode chips (Image, Edit, Video, Music Video, Storyboard), style template chips, a project selector (`?project=` param), a Creative Memory toggle, an Identity Lock toggle, single/multi file attach, a chat log, a loader, output with regenerate. | Project.list. Per mode: **image**: GenerateImage(prompt + memory, refs = last 3 memory images) plus InvokeLLM (style notes). **edit**: GenerateImage(prompt + memory + IDENTITY_LOCK, refs = uploads + memory images) plus InvokeLLM. **video**: InvokeLLM vision (describe the uploaded image), then GenerateVideo(6s), then InvokeLLM. **music**: TranscribeAudio(song), InvokeLLM (concept from lyrics), GenerateVideo(8s), InvokeLLM. **storyboard**: InvokeLLM vision per frame (parallel), GenerateVideo(6s), InvokeLLM. Then Creation.create (with project_id). |
| **Home.jsx** (170), `/tools` | Tool grid (6 cards: Studio plus 5 tools), links to Gallery. | none |
| **TextToImage.jsx** (127) | Title, prompt, memory strip, memory toggle, output. | GenerateImage(prompt + memory context, refs = recent images), InvokeLLM style notes (30 words), Creation.create |
| **ImageEdit.jsx** (143) | Upload 1 image, prompt, memory. | UploadFile, GenerateImage(prompt, refs = [upload, ...memory]), InvokeLLM, Creation.create |
| **ImageToVideo.jsx** (169) | Upload 1 image, motion prompt, duration 4/6/8s. | UploadFile, InvokeLLM vision (describe image), GenerateVideo(prompt, duration), InvokeLLM, Creation.create |
| **MusicVideo.jsx** (172) | Upload a song (mp3/wav/ogg/m4a), visuals prompt, duration 4/6/8s. | UploadFile, TranscribeAudio, InvokeLLM (song concept), GenerateVideo, InvokeLLM, Creation.create. **The output is a silent video. The song is NOT muxed in.** |
| **StoryboardToVideo.jsx** (216) | Upload up to 8 frames, "Analyze" button (story summary), prompt, duration. | UploadFile xN, InvokeLLM vision per frame, InvokeLLM overview, GenerateVideo, InvokeLLM, Creation.create(input_file_urls JSON) |
| **Gallery.jsx** (166) | Grid of the last 50 creations: image/video preview, type badge, open/download link, delete. | Creation.list(50), Creation.delete |
| **Projects.jsx** (115) | Project cards (cover = up to 4 latest images, count), create dialog (name + style brief), delete. | Project.list, Creation.list(500), Project.create, Project.delete |
| **ProjectDetail.jsx** (109) | Project header (name, brief), its creations, "Create in project" (-> Studio `?project=id`), delete ("creations remain but become ungrouped"). | Project.get, Creation.filter(project_id, 200), Project.delete |
| useCreativeMemory.js (41) | Last 5 creations (optionally per project) -> text "CREATIVE MEMORY" context plus up to 3 recent image URLs. | Creation.list / filter(project_id, 5) |
| Login / Register / ForgotPassword / ResetPassword (551), AuthContext, AuthLayout, ProtectedRoute, UserNotRegisteredError, GoogleIcon | Base44 auth | **Dropped.** LifeOS uses silent Supabase anonymous sign-in (`src/lib/SupabaseAuthContext.tsx`). |

Components: ChatBubble 50, TemplateChips 75 (8 style presets), LiquidLoader 67, GenerationOutput 59 (preview, download, copy link, regenerate), FileUploader 77, MultiFileUploader 104, PromptInput 40 (Ctrl/Enter to generate), MemoryStrip 79, MemoryToggle 22, ToolCard 26, ProjectCard 48, CreateProjectDialog 61.

Entities: **Creation** {title, type enum(text_to_image, image_edit, image_to_video, music_video, storyboard_to_video), prompt, input_file_url, input_file_urls (JSON string), output_url*, output_type* (image|video), style_notes, memory_context, project_id}. **Project** {name*, description (style brief)}. **User** {role}: dropped.

Notes: the project "style brief" is shown but **never fed into prompts** in Base44. Base44 durations (4/6/8s) have to map onto what the provider supports.

---

## 2. Condensed target structure (`src/pages/creator/`)

| File | Est. lines | Contents |
|---|---|---|
| `CreatorApp.tsx` | ~120 | Default export. `PanelLayout` (title "Creator", Sparkles icon), a tab bar (Studio / Tools / Gallery / Projects), nested `<Routes>` for `/creator`, `/creator/tools`, `/creator/tools/:tool`, `/creator/gallery`, `/creator/projects`, `/creator/projects/:id`, a provider-status banner, and the Tools grid (ex-Home). |
| `creatorTools.tsx` | ~330 | `StudioView` (chat, mode chips, project select, memory and identity toggles, attachments) and one generic `ToolView` driven by a `TOOLS` config (id, label, icon, upload kind: none/image/images/audio, maxFiles, duration options, placeholder, provider requirement) that replaces the 5 tool pages. |
| `creatorGallery.tsx` | ~220 | `GalleryView`, `ProjectsView` (cards and create dialog), `ProjectDetailView`, and a shared `CreationGrid`/`CreationCard`. |
| `creatorApi.ts` | ~270 | Types, Supabase CRUD plus TanStack Query hooks (`useProjects`, `useCreations`, `useProject`, mutations), `useCreativeMemory`, prompt builders (memory context, IDENTITY_LOCK, style-notes prompt), worker client (`/api/creator/*` with the Supabase bearer token), `generate(mode, input)` orchestrator (a 1:1 port of Studio's switch), video job polling/resume, `useProviders()` (NVIDIA / Ollama Cloud / Erebus availability). |
| `creatorUi.tsx` | ~220 | PromptInput, MemoryToggle, MemoryStrip, TemplateChips (+TEMPLATES), FileDrop (single and multi merged, uploads via `uploadFile(file,'creator')`), GenerationOutput, ChatBubble, Loader, `NeedsKey` notice, and small styled Switch/Select/Dialog built on the already-installed `radix-ui` package. |
| **Total** | **~1,160** | vs ~2,500 lines of feature source (auth excluded), in 5 files instead of ~30 |

Worker (new): `worker/src/routes/creator.ts` (~280) plus 2 lines in `worker/src/working-worker.ts` (import and `router.all("/api/creator/*", mount("/api/creator", creatorRoutes))`).

LifeOS UI already present (`src/components/ui`): button, input, label, badge, progress, Card/StatTile, Panel, Pill, Empty, SectionTitle, Toaster. **Missing:** textarea, switch, select, dialog. Plan: native `<textarea>` plus `radix-ui` primitives styled inside `creatorUi.tsx` (no new shadcn files, no new deps). Animations: `motion/react` (as PanelLayout uses) instead of `framer-motion`. Toasts: `sonner` (installed) / the LifeOS Toaster.
Design: black `#000` background, `glass` modules with `border-white/10`, crimson accent (`text-crimson-400`, crimson active states), white/gray text. Base44 `bg-primary`/`text-muted-foreground`/`bg-card` tokens map to crimson / `text-white/60` / `glass`.

### Source -> destination map
| Source | Destination |
|---|---|
| pages/Studio.jsx | creatorTools.tsx `StudioView` (+ orchestration -> creatorApi.ts `generate`) |
| pages/Home.jsx, components/studio/ToolCard.jsx | CreatorApp.tsx tools grid |
| pages/TextToImage, ImageEdit, ImageToVideo, MusicVideo, StoryboardToVideo .jsx | creatorTools.tsx `ToolView` + `TOOLS` config; logic -> creatorApi.ts `generate` |
| pages/Gallery.jsx | creatorGallery.tsx `GalleryView` |
| pages/Projects.jsx, components/projects/ProjectCard.jsx, CreateProjectDialog.jsx | creatorGallery.tsx `ProjectsView` |
| pages/ProjectDetail.jsx | creatorGallery.tsx `ProjectDetailView` |
| hooks/useCreativeMemory.js | creatorApi.ts `useCreativeMemory` |
| components/studio/PromptInput, MemoryToggle, MemoryStrip, TemplateChips, GenerationOutput, ChatBubble, LiquidLoader, FileUploader, MultiFileUploader | creatorUi.tsx |
| base44/entities/Creation.jsonc, Project.jsonc | Supabase `creator_creations`, `creator_projects` (Section 3) |
| App.jsx routes | CreatorApp.tsx nested routes |
| pages/Login, Register, ForgotPassword, ResetPassword; lib/AuthContext; components/AuthLayout, ProtectedRoute, UserNotRegisteredError, GoogleIcon; entities/User.jsonc | Dropped (Supabase anonymous auth) |
| api/base44Client.js, lib/app-params.js, lib/query-client.js, lib/utils.js, lib/PageNotFound.jsx, components/ScrollToTop.jsx, hooks/use-mobile.jsx, utils/index.ts, main.jsx, index.css, tailwind/vite/eslint/postcss configs, components/ui/* | Dropped (LifeOS equivalents: Supabase client, TanStack QueryClient, theme, PanelLayout, own ui) |
| src/pages/creator/CreatorWrapper.tsx (145-line mock) | Deleted once CreatorApp.tsx is live |

---

## 3. Backend

### 3a. Supabase (additive migration only, applied via Supabase MCP `apply_migration` after approval)
Existing tables checked: `projects` (a client/job CRM table with budget, deadline, site_* columns: wrong shape, don't reuse), `media_items`/`media_albums` (the Media panel's library: keep separate), and **`creator_assets`** (id, user_id, kind, model, prompt, url, content, metadata, created_at). It has 0 rows, **RLS disabled**, and nothing in src/worker references it. It lacks project/status fields. Plan: leave it untouched (no drops) and create the two new tables:

```sql
create table public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,                       -- style brief
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.creator_creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.creator_projects(id) on delete set null,  -- "creations remain, ungrouped"
  type text not null check (type in ('text_to_image','image_edit','image_to_video','music_video','storyboard_to_video')),
  title text,
  prompt text,
  input_urls text[] not null default '{}',   -- replaces input_file_url + JSON input_file_urls
  output_url text,                           -- R2 worker URL; null while pending
  output_key text,                           -- R2 object key (for delete)
  output_type text not null check (output_type in ('image','video')),
  status text not null default 'succeeded' check (status in ('pending','succeeded','failed')),
  provider text, model text, provider_job_id text, error text,
  style_notes text,
  memory_context text,
  settings jsonb not null default '{}'::jsonb,  -- duration, identity_lock, use_memory, template
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.creator_creations (user_id, created_at desc);
create index on public.creator_creations (project_id, created_at desc);
alter table public.creator_projects enable row level security;
alter table public.creator_creations enable row level security;
create policy creator_projects_owner on public.creator_projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy creator_creations_owner on public.creator_creations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- plus a BEFORE UPDATE trigger to set updated_at = now() on both tables
```
(This matches the existing `media_items_owner` / `projects_owner` pattern: `auth.uid() = user_id`, cmd ALL.) There is no `supabase/` folder in the repo, so keep a copy of the SQL at `docs/sql/creator_tables.sql` (see Q7).

### 3b. Storage
- **Inputs** (user uploads): `uploadFile(file, 'creator')` -> worker `POST /api/upload?type=creator` -> R2 `lifeos-storage` at `creator/<uid>/<uuid>.<ext>`, served by `GET /api/upload/object/<key>`. Needs a 1-word change: add `"creator"` to the `UploadKind` union in `src/lib/uploadFile.ts`.
- Creator must **not** accept the `data-url` or Supabase fallbacks. Providers need a fetchable URL, and the Supabase fallback is broken anyway: its bucket list (`lifestor`, `media`, `uploads`, ...) doesn't match the real buckets (CEOGPS, LifeStor, LifeStor2, veriton-uploads), and they are all private, so `getPublicUrl` doesn't work. If `result.source !== 'worker'`, FileDrop shows "Upload storage unavailable". The shared-file bucket fix is a separate optional slice (Phase 8).
- **Outputs**: the worker copies every generated image/video into R2 (`creator/<uid>/out/<uuid>.png|mp4`) before returning. NVIDIA image APIs return base64, and Erebus job outputs are local files.

### 3c. Compute providers: Erebus, Kranos, Ollama, NVIDIA only (revised 2026-09-29)
Chris turned down the cloud AI providers (Gemini, Luma, Replicate, Stability, Runway, Kling, OpenAI, and so on). Creator uses **only** these four:

| Provider | What it is (verified in the codebase and on Kranos3) | How it is reached today | Role in Creator |
|---|---|---|---|
| **NVIDIA** (hosted NIM, build.nvidia.com) | Hosted model APIs. LLM and vision use `https://integrate.api.nvidia.com/v1` (OpenAI-compatible `/chat/completions`). Image generation uses `https://ai.api.nvidia.com/v1/genai/<publisher>/<model>`: `black-forest-labs/flux.1-schnell`, `flux.1-dev`, `flux.1-kontext-dev` (edit), `stabilityai/stable-diffusion-3.5-large`. Video would come from NVIDIA Cosmos; availability on this key is **unverified**. Speech (Riva/Parakeet/Whisper NIM) is served over **gRPC**, so a Worker can't call it directly. | Secrets already exist in `.env` and on the worker: `NVAPI_KEY`, `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`. No LifeOS code calls NVIDIA yet. `NVIDIA_BASE_URL` points to `https://build.nvidia.com`, which is the website and not the API, so `creator.ts` hard-codes the two API hosts as constants. Neither key has been tested. | **Primary** for LLM, vision, text-to-image and image edit. **Primary if Cosmos is available** for video. |
| **Ollama** | Two separate things share this name. (a) **Ollama Cloud**: `OLLAMA_BASE_URL` = `https://ollama.com` plus `OLLAMA_API_KEY`. Both are in `.env` and on the worker, and the worker can reach it. (b) **Local Ollama on Kranos3**: v0.34.3 is installed but **not running** (nothing on :11434). It has 14 models (67 GB): `moondream` (vision), `gemma4:e2b` / `gemma4:e4b` / `batiai/gemma4-e4b:q4` (possibly multimodal, to verify), `qwen3:4b`, `llama3.2:3b`, `mistral-nemo:12b`, `gemma2`, `olmo2:13b`, `nous-hermes:13b`, `deepseek-coder-v2:16b`, `qwen2.5-coder:3b` and `:latest`. **Ollama can't generate images or video.** | Cloud: the worker calls it directly. Local: only `ErebusCore.ts` uses it (`VITE_EREBUS_OLLAMA_URL` defaults to `http://localhost:11434`; it calls `/api/tags` and the OpenAI-compatible `/v1/chat/completions`), so it only works in local dev. | LLM fallback #2 (cloud). Vision and LLM fallback #3 (local, through Erebus). |
| **Erebus** | (1) `ErebusCore.ts`, the in-app autonomous agent behind the Agent Dock. Its reasoning chain is: Python backend, then local Ollama, then WebLLM in the browser, then direct cloud APIs using `VITE_*` keys, then the worker's `/api/llm/invoke` (a mock). (2) A **local Python FastAPI server, "Erebus v2"**: `src/lib/agents/advanced_agent/runtime/main.py`, port `FASTAPI_PORT` (default 8000). Routes: `/health`, `/wake`, `/chat`, `/task`, `/stream`, `/sync`, `/memory`, `/memory/learn`, `/execute`. Its `router.py` currently calls **Groq, Grok, OpenAI and Perplexity** (cloud keys). Related local services: `services/browser-agent/server.js` (:8100, Playwright browse endpoints plus WebSocket) and `video-gen.js` (an ffmpeg image-concat video builder). | Frontend default: `VITE_EREBUS_BACKEND_URL` falls back to `http://localhost:8000` in dev and to the worker in prod. **Not running** (nothing listens on 8000 or 8100). No tunnel. | The **local media gateway on Kranos3**: local Ollama (vision/LLM), **ffmpeg** (installed, 9.0.2: music-track muxing, storyboard and still-image motion videos), local Whisper for transcription (not installed yet), and optionally ComfyUI (not installed). |
| **Kranos** | `src/lib/agents/kranos/Kranos.ts`, the "Strategist" agent (planning, memory, decisions). It is a client-side TypeScript agent built on `UnifiedAgentCore.ts`. Its LLM goes to `${VITE_WORKER_URL}/api/llm/invoke`, which is a **mock**, so Kranos has no real model today. It also has browser (`localhost:8100`) and media endpoints (`localhost:8000/8001/8002`, with Replicate/Runway/ElevenLabs fallbacks). It is not a separate server. Kranos3 is also the name of this PC, which hosts the Erebus services. | Through the worker (the mock). | **Creative director and orchestrator.** It writes and refines prompts, plans storyboard shots, writes style notes and the song concept, and summarizes Creative Memory. Its LLM calls go through the new creator `/llm` chain below (never the mock). |

No sibling `erebus`/`kranos` projects exist in `D:\dev` (it contains `LifeApp`, `LifeOS1`, `lifeos1.agentzero` (an older LifeOS copy with its own `advanced_agent`/`backend`), `models` (`deepseek-coder-v2-lite`, `mistral-nemo` weights), `Nexus-Connect`, and others).
**Local GPU:** NVIDIA GeForce **GTX 1650, 4 GB VRAM**, driver 610.62. That is enough for small LLMs, vision (moondream, gemma4 e2b/e4b), Whisper small/medium and, slowly, SD 1.5 / SDXL-Turbo in ComfyUI. It is **not** enough for FLUX, SD3.5, or any local video generation. No ComfyUI, A1111, Forge, InvokeAI, LM Studio, Docker or cloudflared is installed (ports 8188, 7860, 1234 and 11434 are all closed). `.env` has `LM_BASE_URL=http://localhost:1234` (LM Studio), but LM Studio isn't installed.

### 3d. Feature -> provider routing (fallback order, left to right)
| Feature | 1st | 2nd | 3rd | Last resort / state |
|---|---|---|---|---|
| Studio chat, style notes, song concept, story overview (Kranos persona) | NVIDIA LLM (integrate.api, e.g. a Llama/Nemotron instruct model) | Ollama Cloud | Erebus -> local Ollama (`qwen3:4b` / `mistral-nemo:12b`) | "No LLM provider" banner |
| Vision (describe the upload, per-frame storyboard analysis) | NVIDIA VLM (integrate.api vision model) | Ollama Cloud VL model (if the account has one) | Erebus -> local `moondream` / `gemma4` | Skip the description and use the user's prompt only |
| Text-to-image | NVIDIA `flux.1-schnell` (fast), `flux.1-dev` / `stable-diffusion-3.5-large` (quality) | Erebus -> ComfyUI SD1.5/SDXL-Turbo (**must be installed**; slow on 4 GB) | n/a | NeedsProvider notice |
| Image edit + Identity Lock (references: upload + memory images) | NVIDIA `flux.1-kontext-dev` (**hosted preview only accepts NVIDIA's example images**, so real uploads need verification or a self-hosted Kontext NIM, which 4 GB can't run) | NVIDIA FLUX text-to-image from a VLM description of the reference (identity is **not** preserved) | Erebus -> ComfyUI img2img/IP-Adapter (not installed) | Clear "identity lock unavailable" note |
| Image-to-video | NVIDIA Cosmos image-to-world (**verify** the model, access, duration and licence) | Erebus -> ffmpeg motion video from the still (Ken Burns zoom/pan; not generative) | n/a | NeedsProvider |
| Music video | Transcribe: Erebus -> local Whisper (to install; NVIDIA ASR is gRPC-only), then the LLM concept (chain above), then video (image-to-video chain, or text-to-image frames + ffmpeg), then **Erebus ffmpeg muxes the song into the MP4** (an upgrade over Base44, which produced silent video) | Skip transcription and use the prompt + filename only | n/a | Silent video if Erebus is offline |
| Storyboard-to-video | Vision per frame -> Kranos shot plan -> NVIDIA Cosmos with frame 1 as the keyframe | Erebus -> ffmpeg slideshow of the uploaded frames with crossfades and motion (reuses `video-gen.js` concat logic) | n/a | NeedsProvider |
| Gallery / Projects / Creative Memory | Supabase `creator_*` tables + R2 (Sections 3a/3b, unchanged). Memory context is built client-side (`useCreativeMemory`) and fed to Kranos. | Optional: mirror summaries to Erebus `/memory/learn` | n/a | n/a |

### 3e. Networking: how the browser and worker reach each provider
- **Browser (Cloudflare Pages app) -> worker only.** The deployed app can't call `localhost` (the user's browser would be hitting its own machine, and browsers block mixed-content and private-network requests), so all Creator AI calls go through `/api/creator/*` on `lifeos1-api`.
- **Worker -> NVIDIA / Ollama Cloud:** direct HTTPS using the existing secrets (`NVIDIA_API_KEY` or `NVAPI_KEY`, `OLLAMA_API_KEY`). Works today once the code exists.
- **Worker -> Erebus (on Kranos3):** needs a **Cloudflare Tunnel**. **None exists today:** no `cloudflared` binary, no `~/.cloudflared`, no tunnel config in `D:\dev`, no tunnel hostnames in code or env. Proposal (needs approval, not created): install `cloudflared` as a Windows service with a named tunnel, e.g. `erebus.ceogps.com` -> `http://localhost:8000`. Protect it with a **Cloudflare Access service token** so only the worker can call it (new worker secrets `EREBUS_URL`, `EREBUS_ACCESS_CLIENT_ID`, `EREBUS_ACCESS_CLIENT_SECRET`, plus a shared `EREBUS_SHARED_SECRET` header checked by FastAPI). Don't expose Ollama :11434 or the browser agent :8100 publicly. Erebus calls them over localhost.
- **Availability:** Erebus only works while Kranos3 is on and the services are running. `/providers` probes `EREBUS_URL/health` (2 s timeout) and reports `erebus: false` otherwise, and the UI hides the local-only fallbacks.
- **Local dev (vite on Kranos3):** the frontend may still talk to `localhost:8000` directly, as `ErebusCore.ts` already does. Creator stays worker-first for consistency.
- Payload sizes: Erebus pulls inputs from R2 by URL and uploads outputs back through the worker (or returns a URL that the worker copies into R2). Large MP4s never pass through the browser.

### 3f. Worker endpoints (`/api/creator/*`, new `worker/src/routes/creator.ts`)
Every endpoint **verifies the Supabase JWT** by calling `GET ${SUPABASE_URL}/auth/v1/user` with the bearer token and apikey = publishable key. The existing upload route only trusts the `X-User-Id` header, which isn't enough for endpoints that spend NVIDIA credits and local GPU time. Optional allowlist: `CREATOR_ALLOWED_USERS` (Q2).

| Endpoint | Purpose | Routing (3d) |
|---|---|---|
| `GET /providers` | `{nvidia, ollamaCloud, erebus, erebusFeatures:{ollama, ffmpeg, whisper, comfy}}`. Per-feature availability plus the missing secret/service name (names only) | Probes (cached 60 s in KV) |
| `POST /llm` `{prompt, system?, image_urls?}` -> `{text, provider, model}` | style notes, concepts, frame descriptions (vision); Kranos's LLM | NVIDIA -> Ollama Cloud -> Erebus `/creator/llm` |
| `POST /image` `{prompt, reference_urls?, mode:'generate'|'edit'}` -> `{url, key, provider}` | text-to-image, image edit | NVIDIA FLUX/SD3.5 (Kontext for edit) -> Erebus `/creator/image` (ComfyUI) |
| `POST /transcribe` `{audio_url}` -> `{text}` | Music Video lyrics | Erebus `/creator/transcribe` (local Whisper) |
| `POST /video` `{prompt, image_url?, frame_urls?, audio_url?, duration}` -> `{job_id}` | image-to-video, music video, storyboard | NVIDIA Cosmos (if verified) -> Erebus `/creator/video` (ffmpeg motion/slideshow). Erebus also muxes `audio_url` |
| `GET /video/:job_id` -> `{status, url?, error?}` | poll; on completion copies the MP4 into R2 | the provider that owns the job |
| `DELETE /object` `{key}` | delete R2 outputs/inputs when a creation is deleted (key must start with `creator/<uid>/`) | n/a |

New **Erebus routes** (later slice, in the FastAPI app `runtime/main.py`; all require the shared-secret header): `GET /creator/health` (reports ollama/ffmpeg/whisper/comfy availability), `POST /creator/llm` (local Ollama), `POST /creator/transcribe` (faster-whisper), `POST /creator/image` (ComfyUI API :8188, optional), `POST /creator/video` + `GET /creator/video/{id}` (ffmpeg jobs: motion from still, frame slideshow, audio mux). The orchestration (memory context, IDENTITY_LOCK text, prompt builders, per-frame analysis) stays **client-side** in `creatorApi.ts`, framed as Kranos, and the worker stays a thin router with fallbacks.
Video flow is unchanged: insert a row with `status='pending'` and `provider_job_id` (prefixed `nvidia:` / `erebus:`), poll every 5 s, then mark it `succeeded` with the R2 URL or `failed` with the error. The gallery resumes polling after a reload.

### 3g. Keys and config (names only; values never printed)
| Name | `.env` | Worker secret | Use |
|---|---|---|---|
| `NVIDIA_API_KEY`, `NVAPI_KEY` (both nvapi-format) | yes | **yes** | NVIDIA LLM/VLM/image/video. Pick one (`NVIDIA_API_KEY`, falling back to `NVAPI_KEY`). Validity untested. |
| `NVIDIA_BASE_URL` | yes (points to `https://build.nvidia.com`, which is wrong) | yes | Ignore it. Use constants `https://integrate.api.nvidia.com/v1` and `https://ai.api.nvidia.com/v1/genai` |
| `OLLAMA_API_KEY`, `OLLAMA_BASE_URL` (`https://ollama.com`) | yes | **yes** | Ollama Cloud LLM (and VL if available) |
| `EREBUS_URL`, `EREBUS_ACCESS_CLIENT_ID`, `EREBUS_ACCESS_CLIENT_SECRET`, `EREBUS_SHARED_SECRET` | **missing** | **missing** | Worker -> tunnel -> Erebus (proposed names) |
| `VITE_EREBUS_BACKEND_URL`, `VITE_EREBUS_OLLAMA_URL`, `VITE_EREBUS_BROWSER_AGENT_URL` | not set (code defaults to localhost) | n/a | Agent Dock only; Creator doesn't need them |
| `FASTAPI_PORT` | in `advanced_agent/.env` | n/a | Erebus port (default 8000) |

Cloud-provider keys (Gemini, Luma, Replicate, Stability, OpenAI, Groq, and so on) are **not used by Creator**, even where they exist.
Hygiene (pre-existing, not Creator-specific): the root `.env` has **two bare value lines with no `NAME=`**. One follows the `NVAPI_KEY` line and looks like an nvapi key; the other follows `BD_DATABASE`. Dotenv parsers skip or misread them. Remove them or give them names, and consider rotating that key, because it sits in plaintext outside a named variable. The Erebus backend `router.py` and `ErebusCore.ts`/`ErebusMedia.ts` still call cloud providers (Groq, Grok, OpenAI, Perplexity, Gemini, DeepSeek, Stability, Replicate, HF, Pollinations, Luma, D-ID, ElevenLabs). That's outside Creator's scope, but Q9 asks whether to re-point them to NVIDIA/Ollama.
`config.ts` reads `env.SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`, but the worker only has the `VITE_`-prefixed secrets. The creator auth check reads the `VITE_` names, with the plain names as a fallback. The existing `/api/llm/invoke` route is a **mock**, and Creator must not use it.

---

## 4. Sidebar / routing cleanup
1. `src/components/layout/sidebar-items.ts` line 62: `label: "CreatorOS"` -> `label: "Creator"`. Keep `id: "creator-os"`, icon PenTool, href `/creator`.
2. `src/AppRoutes.tsx`: line 115 `/creator` -> `/creator/*` (nested tabs); **delete line 140** (the dead duplicate outside AppLayout); line 9's lazy import -> `./pages/creator/CreatorApp`.
3. `src/components/layout/AppLayout.tsx`: delete the unused `CreatorOSPage` (lines ~216-226); remove `CreatorOSPage` from the `src/components/layout/index.ts` line 7 export list.
4. Check that the sidebar active highlight still works on `/creator/gallery` etc. (prefix match).

---

## 5. Phased build order (each slice can be approved on its own)
Before each slice, back up the touched files (git in D:\dev\LifeApp is broken: "not a git repository").

| # | Slice | Touches | Verify |
|---|---|---|---|
| 0 | Housekeeping: sidebar label, route `/creator/*`, delete dup route + CreatorOSPage | sidebar-items.ts, AppRoutes.tsx, AppLayout.tsx, layout/index.ts | `pnpm type-check` (no new errors vs tsc.txt baseline), `pnpm build`; sidebar shows "Creator"; `/creator` still renders inside AppLayout |
| 0.5 | **Provider verification (read-only probes, after approval to use the keys):** NVIDIA `GET /v1/models` (key valid? which VLM, LLM, FLUX/SD3.5/Kontext and Cosmos models are enabled; does Kontext accept arbitrary images; credit limits), Ollama Cloud model list (any VL model?), start local Ollama and confirm `gemma4` vision | none (curl) | A written model shortlist; pick the model ids for `creator.ts` constants |
| 1 | DB migration (2 tables + RLS + trigger) | Supabase (additive) | `list_tables` shows both with RLS on; as an anon session, insert/select own rows OK; a second anon session sees 0 rows; `get_advisors` shows no new warnings |
| 2 | Worker `creator.ts`: JWT check, `/providers`, `/llm` (NVIDIA -> Ollama Cloud), `/image` (NVIDIA FLUX) + R2 output | worker route + mount; `pnpm deploy:worker` | curl without a token -> 401; with a token, `/providers` shows nvidia/ollamaCloud true; `/image` returns a `/api/upload/object/creator/...` URL that loads |
| 3 | Frontend shell + data: CreatorApp tabs, creatorApi CRUD, creatorUi basics, Gallery/Projects/ProjectDetail on real tables (empty states, no fake counts) | 3-4 new files, AppRoutes import; CreatorWrapper kept until the end | create/delete a project; ungrouping on delete; reload persists; empty gallery shows the Empty state |
| 4 | Text to Image + Image Edit (generic ToolView), uploads (`'creator'` kind), memory strip/toggle, identity lock (Kontext or degraded path per 0.5), templates; Kranos prompt builder | creatorTools.tsx, uploadFile.ts (1-word union) | generate -> row + R2 object; edit behaviour matches the 0.5 findings; the NeedsProvider state shows when NVIDIA is off |
| 5 | **Erebus gateway + tunnel** (needs approval: installs software, creates a Cloudflare tunnel/DNS/Access app): install cloudflared service + named tunnel -> :8000, an Access service token, worker secrets `EREBUS_*`; add `/creator/*` routes to FastAPI (health, llm via local Ollama, ffmpeg video jobs); install faster-whisper; register Erebus as a Windows startup service | advanced_agent/runtime/main.py (+ new creator module), cloudflared config, worker secrets | `curl https://erebus.<domain>/creator/health` without the token -> 403, with it -> ok; worker `/providers` shows erebus true; turning Kranos3 off -> erebus false and the UI degrades cleanly |
| 6 | Video: worker `/video` + poll (NVIDIA Cosmos if verified, else Erebus ffmpeg); Image to Video + Storyboard (per-frame analysis, Analyze button) | creator.ts, creatorTools/creatorApi | pending -> succeeded; reload mid-job resumes; MP4 plays from R2; failure sets `failed` with a message |
| 7 | Music Video: `/transcribe` (Erebus Whisper) + video + **song mux** (Erebus ffmpeg) | creator.ts, Erebus creator module, TOOLS config | mp3 -> transcript -> concept -> video **with audio**; Erebus offline -> silent-video fallback with a note |
| 8 | Studio chat (unified view, Kranos persona, project selector, `?project=`), Tools grid, delete-with-R2-cleanup | creatorTools.tsx, creatorGallery.tsx | all 5 modes work from Studio; "Create in project" preselects; delete removes the R2 object |
| 9 | Optional: ComfyUI on Kranos3 (SD1.5/SDXL-Turbo, IP-Adapter for identity) as the local image fallback; cleanup: delete CreatorWrapper.tsx, optional `uploadFile.ts` bucket fix, mark CREATOR_CONDENSE_PLAN superseded | Erebus `/creator/image`, small | build, `rg CreatorWrapper` returns nothing, full click-through |

## Risks
- **NVIDIA hosted limits:** free/trial credits and rate limits; model availability changes; hosted Kontext preview may only accept example images (so identity-lock editing may be unavailable); Cosmos video may be missing from the hosted catalog or unsuitable (length, licence, latency). If there is no video model, "video" features are Erebus ffmpeg compositions (motion and slideshow), not generative video.
- **Local hardware:** a GTX 1650 with 4 GB can't run FLUX, SD3.5 or video models. Local image generation (ComfyUI SD1.5/SDXL-Turbo) is slow and lower quality. Local is a fallback, not the primary.
- **Erebus availability:** depends on Kranos3 being on, awake, and running Ollama + FastAPI + cloudflared. It needs a startup service and health probing; otherwise features silently lose their fallback.
- **Tunnel security:** exposing a FastAPI with `/execute` (code execution) is dangerous. Only `/creator/*` should be reachable through the tunnel (path allowlist in the cloudflared ingress + Access service token + a shared secret). Never expose `/execute`, `/memory`, :11434 or :8100.
- **Cost/abuse:** anonymous Supabase sessions could spend NVIDIA credits and local GPU time. Mitigation: JWT check + `CREATOR_ALLOWED_USERS` + a per-user daily cap in KV (Q2).
- **Anonymous identity is fragile:** clearing storage creates a new anon uid, and old creations become invisible under RLS (Q5).
- **R2 object URLs are public by unguessable key** (existing upload design). Providers and Erebus need fetchable URLs.
- Worker limits: request body (~100 MB), CPU/time for sync calls. NVIDIA FLUX returns base64 (decode -> R2). Video is async.
- Model ids change: keep them as constants in `creator.ts` (and the Erebus config).
- No git safety net (broken .git): manual backups per slice.
- Security (pre-existing, not Creator-specific): Supabase advisor reports **54 public tables with RLS disabled** (including `creator_assets`, `contacts`, `crm*`, `api_keys`, `oauth_tokens`, `lifeos_store`). `.env` has `VITE_`-prefixed secrets (e.g. `VITE_CLOUDFLARE_API_TOKEN`) that Vite bundles if code references them, plus the stray bare key line (3g). Worth a separate review.

---

## 6. Open questions for Chris
1. **Which "Kranos" do you mean:** the Kranos agent (planner/orchestrator, as mapped here) or the Kranos3 PC as the local GPU host (which is where Erebus runs in this plan)? And is there a separate Erebus/Kranos server elsewhere (another machine or VPS) that I should know about? None was found in `D:\dev`.
2. Lock the AI endpoints to your user id(s) plus a daily cap? (Recommended.)
3. OK to set up a **Cloudflare Tunnel** (cloudflared service on Kranos3, hostname like `erebus.ceogps.com`, protected by Cloudflare Access) so the deployed app can reach Erebus and local Ollama? Should Kranos3 stay on as the always-on local node?
4. If NVIDIA has no usable video model on your key, are ffmpeg "motion/slideshow" videos from Erebus acceptable, or should video wait?
5. OK to install **faster-whisper** (Music Video transcription) and optionally **ComfyUI** on Kranos3? (4 GB VRAM: slow, SD1.5/SDXL-Turbo only.)
6. Music Video: mux your song into the MP4 via Erebus ffmpeg (recommended; ffmpeg is already installed)?
7. The unused `creator_assets` table (0 rows, RLS off): ignore it (recommended), or migrate/drop it later?
8. Creations are tied to the anonymous session uid. Link to a permanent login later?
9. Should Erebus's own router (`router.py`: Groq/Grok/OpenAI/Perplexity) and ErebusCore/ErebusMedia cloud fallbacks also be re-pointed to NVIDIA/Ollama (separate task)?
10. Default tab: Studio chat or the Tools grid? Migration SQL location (`docs/sql/` or `supabase/migrations/`)? Feed the project style brief into prompts and use storyboard frame 1 as the video keyframe (small upgrades beyond parity)?
