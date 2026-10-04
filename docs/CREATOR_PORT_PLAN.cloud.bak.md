# Creator Port Plan: Base44 "Creator" app -> LifeOS (read-only analysis, 2026-09-29)

Scope: bring Chris's real Creator app (Base44 export) into LifeOS at `/creator`. This is a plan only. No app code, DB, or worker changes were made to produce it.
This plan supersedes the scope of `docs/CREATOR_CONDENSE_PLAN.md`. That plan's housekeeping items (sidebar label, dead route, dead placeholder) are folded into Phase 0 here.

Sources inspected:
- Export: `creator-base44.zip` (export-report.json: exported 2026-07-18, 106 files, 0 assets, 1 harmless warning about a cross-origin preview iframe scan). Feature code is about 2,500 lines excluding auth; about 3,700 lines including auth/boilerplate.
- `src/api/base44Client.js` and every page are a blank stub (`globalThis.__B44_DB__ || {...}` returning empty values). The real backend behavior was reconstructed from each call site (below).
- LifeOS: `D:\dev\LifeApp` (src, worker, .env names, `wrangler secret list` names), Supabase LifeOS1 (`mhvcdstgkyplhzjptgfr`) table list and columns (read-only).

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
| `creatorApi.ts` | ~270 | Types, Supabase CRUD plus TanStack Query hooks (`useProjects`, `useCreations`, `useProject`, mutations), `useCreativeMemory`, prompt builders (memory context, IDENTITY_LOCK, style-notes prompt), worker client (`/api/creator/*` with the Supabase bearer token), `generate(mode, input)` orchestrator (a 1:1 port of Studio's switch), video job polling/resume, `useProviders()`. |
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
- **Outputs**: the worker copies every generated image/video into R2 (`creator/<uid>/out/<uuid>.png|mp4`) before returning. Provider URLs expire, and Gemini returns base64.

### 3c. Worker endpoints (`/api/creator/*`, new `worker/src/routes/creator.ts`)
Every endpoint **verifies the Supabase JWT** by calling `GET ${SUPABASE_URL}/auth/v1/user` with the bearer token and apikey = publishable key. The existing upload route only trusts the `X-User-Id` header. These endpoints spend money, so they must not do the same. Optional allowlist: `CREATOR_ALLOWED_USERS` (Q2).

| Endpoint | Purpose | Provider (recommended) |
|---|---|---|
| `GET /providers` | `{llm, image, video, transcribe}` booleans plus a missing-key name per feature (names only) | n/a |
| `POST /llm` `{prompt, image_urls?}` -> `{text}` | style notes, lyric concept, frame descriptions (vision) | **Gemini 2.5 Flash** (`GEMINI_API_KEY`, on worker). Images are fetched from R2 and sent as inline_data. |
| `POST /image` `{prompt, reference_urls?}` -> `{url, key}` | text-to-image and image edit (identity lock) | **Gemini 2.5 Flash Image** (same key; supports reference-image editing). Fallback: Replicate (Flux Kontext). |
| `POST /transcribe` `{audio_url}` -> `{text}` | Music Video lyrics | **Gemini** audio understanding (same key). Alternatives: OpenAI Whisper / Groq Whisper (keys only in .env). |
| `POST /video` `{prompt, image_url?, duration}` -> `{job_id}` | image-to-video, music video, storyboard | **Luma Dream Machine ray-2** (`LUMA_API_KEY`, on worker). Supports text-to-video plus an image keyframe; durations 5s/9s, so 4/6 map to 5s and 8 maps to 9s. |
| `GET /video/:job_id` -> `{status, url?, error?}` | poll; on completion streams the mp4 into R2 | Luma |
| `DELETE /object` `{key}` | delete the R2 output/input when a creation is deleted (key must start with `creator/<uid>/`) | n/a |

The orchestration (memory context, IDENTITY_LOCK text, style-notes prompts, per-frame analysis) stays **client-side** in `creatorApi.ts` as a faithful port of the Base44 logic. The worker stays a thin, generic provider proxy.
Video flow: insert a row with `status='pending'` and `provider_job_id`, poll every 5s, then update to `succeeded` with output_url/key (or `failed` with the error). The gallery resumes polling for pending rows after a reload.

### 3d. AI keys (names only; values never read)
| Provider | Local `.env` | Worker secret | Use |
|---|---|---|---|
| Gemini / Google AI Studio | GEMINI_API_KEY, GOOGLE_AI_STUDIO_API_KEY, GOOGLE_API_KEY | **yes** (all three) | LLM, vision, image, transcribe |
| Luma | LUMA_API_KEY | **yes** | video |
| OpenRouter | yes | **yes** | LLM fallback |
| Ollama | OLLAMA_API_KEY, OLLAMA_BASE_URL | yes | not suitable (no image/video) |
| Replicate | REPLICATE_API_KEY | only as `VITE_REPLICATE_API_KEY` | image/video fallback (read that name, or `wrangler secret put REPLICATE_API_KEY`) |
| Stability | STABILITY_AI_API_KEY | only as `VITE_STABILITY_AI_API_KEY` | image fallback |
| ElevenLabs | ELEVENLABS_API_KEY | only as `VITE_ELEVENLABS_API_KEY` | not needed |
| OpenAI | OPENAI_API_KEY | **no** (only `VOICE_TOOLS_OPENAI_KEY`, likely OpenAI) | optional (gpt-image-1, whisper) |
| xAI / Grok | XAI_API_KEY, GROK_API_KEY | **no** | optional |
| Runway | RUNWAY_API_KEY | **no** | optional video alternative |
| Kling | KLING_API_KEY, KLINGAI_API_KEY | **no** | optional video alternative |
| Groq | GROQ_API_KEY | **no** (only GROQ_MODEL) | optional whisper |
| fal | **missing** | **missing** | n/a |
| Suno | **missing** | **missing** | n/a (not needed; Base44 never generated music) |

So every Base44 feature is covered by keys **already on the worker** (Gemini and Luma). Nothing new has to be added to ship. If a key is absent at runtime, `/providers` reports it, and the tool shows a disabled Generate button with "Needs GEMINI_API_KEY on the worker" (or LUMA_API_KEY). No mock output. Note: the existing `/api/llm/invoke` route is a **mock** ("Mock response to: ..."), so Creator must not use it.
Also: `config.ts` reads `env.SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`, but the worker only has `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` secrets. The creator auth check will read the `VITE_` names (with the plain names as fallback).

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
| 1 | DB migration (2 tables + RLS + trigger) | Supabase (additive) | `list_tables` shows both with RLS on; as an anon session: insert/select own rows OK; a second anon session sees 0 rows; `get_advisors` shows no new warnings |
| 2 | Worker `creator.ts`: JWT check, `/providers`, `/llm`, `/image` (Gemini) + R2 output | worker route + mount; `pnpm deploy:worker` | curl without a token -> 401; with a token: `/providers` true/true; `/image` returns a `/api/upload/object/creator/...` URL that loads |
| 3 | Frontend shell + data: CreatorApp tabs, creatorApi CRUD, creatorUi basics, Gallery/Projects/ProjectDetail on real tables (empty states, no fake counts) | 3-4 new files, AppRoutes import; CreatorWrapper kept until the end | create/delete a project; ungrouping on delete; reload persists; empty gallery shows the Empty state |
| 4 | Text to Image + Image Edit (generic ToolView), uploads (`'creator'` kind), memory strip/toggle, identity lock, templates | creatorTools.tsx, uploadFile.ts (1-word union) | generate -> row in `creator_creations` + object in R2; edit keeps the face; memory context is applied; a missing key shows the NeedsKey state (test by pointing at a bogus provider flag) |
| 5 | Video: worker `/video` + poll (Luma); Image to Video + Storyboard (per-frame analysis, Analyze button) | creator.ts, creatorTools/creatorApi | pending row -> succeeded; reload mid-job resumes; mp4 plays from R2; failure sets status failed with a message |
| 6 | Music Video: worker `/transcribe` (Gemini) + tool | creator.ts, TOOLS config | mp3 upload -> transcript -> concept -> video; audio >20MB shows a clear error |
| 7 | Studio chat (unified view, project selector, `?project=`), Tools grid, delete-with-R2-cleanup | creatorTools.tsx, creatorGallery.tsx | all 5 modes work from Studio; "Create in project" preselects the project; deleting a creation removes the R2 object |
| 8 | Cleanup: delete CreatorWrapper.tsx; optional fix of the `uploadFile.ts` bucket list; mark CREATOR_CONDENSE_PLAN superseded | small | build, `rg CreatorWrapper` returns nothing, full click-through |

## Risks
- **Cost/abuse:** anyone who opens the app gets an anonymous Supabase session and could spend Gemini/Luma credits. Mitigation: JWT check plus the `CREATOR_ALLOWED_USERS` allowlist and a simple per-user daily cap in KV (Q2).
- **Anonymous identity is fragile:** if browser storage is cleared, a new anon uid is created and old creations become invisible under RLS (Q5).
- **R2 object URLs are public by unguessable key** (the existing upload design; immutable cache). Providers need fetchable URLs, so accept it, but don't upload anything sensitive.
- Worker limits: request body (~100MB), sync calls must finish in time (Gemini image ~10-30s is OK; video is async by design). Stream large mp4s into R2.
- Model names/APIs change (Gemini image model id, Luma ray-2): keep the model ids as constants in creator.ts.
- Luma supports 5s/9s only; Base44 offered 4/6/8s (mapped as above). Storyboard: Base44 only described the frames in text; the plan also passes frame 1 as a Luma keyframe for identity (Q8).
- Music video output is silent (same as Base44). Muxing needs ffmpeg outside the worker (Q3).
- No git safety net (broken .git): manual backups per slice.
- Security (pre-existing, not Creator-specific): Supabase advisor reports **54 public tables with RLS disabled** (including `creator_assets`, `contacts`, `crm*`, `api_keys`, `oauth_tokens`, `lifeos_store`). Anyone with the anon key can read or modify them. `.env` also has `VITE_`-prefixed secrets (e.g. `VITE_CLOUDFLARE_API_TOKEN`), and Vite bundles those into the client if code references them. Worth a separate review; this plan does not touch them.

---

## 6. Open questions for Chris
1. Video provider: use **Luma** (key already on the worker), or Runway/Kling (keys only in .env; I'd `wrangler secret put` them)?
2. Lock the AI endpoints to your user id(s) plus a daily cap? (Recommended, since every visitor gets an anon session.)
3. Music Video: keep it silent like Base44, or mux your song into the MP4 later (needs an ffmpeg service)?
4. The unused `creator_assets` table (0 rows, RLS off): ignore it (recommended), or migrate/drop it later?
5. Creations are tied to the anonymous session uid. Link to a permanent login (e.g. Google) later so they survive a browser reset?
6. Default tab: Studio chat (as in Base44) or the Tools grid?
7. Where should the migration SQL live in the repo (`docs/sql/` or a new `supabase/migrations/`)?
8. Small upgrades beyond strict parity: feed the project style brief into prompts, and use storyboard frame 1 as the video keyframe. OK?