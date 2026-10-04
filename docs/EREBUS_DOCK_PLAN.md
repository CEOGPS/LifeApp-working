# Erebus Dock Redesign: Plan and Build Checklist
_2026-09-29. Status: **built and verified** (Chris approved building without waiting for review)._

## Reference inputs
- **Two HTML files** are saved Pinterest pages ("AI Dock" and "Dashboard" pins), not code demos. They have no avatar, canvas, or animation code worth reusing, so they're visual references only (navy/neon glass dashboards).
- **Hologram PNG**: green code rain over a translucent face. Rebuilt as a CSS filter plus a canvas rain layer.
- **Dashboard JPG**: navy glass cards, a central hologram avatar, and a mic orb. Used for the stage layout. The navy restyle is estimated below and not built.

## Layout
```
 ┌ AppLayout (every page) ───────────────────────────────────────┐
 │ Topbar / Banner                                               │
 │   ┌ AI STAGE (placement = stage) ─────────────────────────┐   │
 │   │ [avatar]  EREBUS · via NVIDIA          [dock][hub][^] │   │
 │   │ [ ctrl ]  "latest reply…"                             │   │
 │   │           [ Ask Erebus…                        ➤ ]    │   │
 │   └───────────────────────────────────────────────────────┘   │
 │   <page content>                           ┌ DOCK ─────────┐  │
 │                                            │hdr: hub ⧉ ⤢ ⚙ ✕│  │
 │                                            │skins  placement│  │
 │                                            │ [avatar window]│  │
 │                                            │voice spd vol ▶ │  │
 │                                            │Chat|Write|Img… │  │
 │                                            │ mode content   │  │
 │                                            └───────────────┘  │
 │                                                          [✨]  │
 └───────────────────────────────────────────────────────────────┘
```

## Components (src/lib/agents/erebus/dock/ unless noted)
| File | New/Edit | Role |
|---|---|---|
| `AvatarHost.tsx` | new | The one live avatar (face, voice, mic). Its DOM node is moved between slots, never re-created |
| `AvatarSlot.tsx` | new | Slot registration: dock, stage, float, pip |
| `AIStage.tsx` | new | Center stage on every page, with a quick ask box |
| `FloatWindow.tsx` | new | Draggable in-page window. Also the Detach fallback |
| `CodeRain.tsx` | new | Matrix canvas that reacts to `--open` |
| `skins.ts` | new | Skin configs |
| `VoiceBar.tsx` | new | Mute, voice, speed, volume, test |
| `ModePanels.tsx` | new | Writer, Image, Sound, Video |
| `erebusStack.ts` | new | Backend chain (Chris's stack only) |
| `dockStore.ts` | new | Zustand store, persisted to Supabase |
| `useSpeechInput.ts` | new | Push-to-talk |
| `components/ErebusDock.tsx` | edit | Redesigned. Keeps quick chat, the ⤢ panel, ✨, and Esc |
| `ui/ErebusFace.tsx` | edit | `speak(url, volume)` GainNode, skin props, rAF works in PiP |
| `hooks/useErebusVoice.ts` | edit | Volume, `lang_code`, `KOKORO_VOICES` |
| `components/layout/AppLayout.tsx` | edit | Mounts `<AIStage/>` |

## Skins
- Skin = portrait + CSS filter + layers (`rain`, `scanlines`, `vignette`, `flicker`) + glow RGB + feature tone.
- The layers render inside ErebusFace and read the live `--open`/`--glow` audio level (rain gets brighter and faster while Erebus talks).
- Built skins: Portrait, Matrix hologram, Crimson HUD, Blue hologram, Noir. Add one by adding an entry to `skins.ts`.

## Modes and backends (no paid cloud AI)
| Mode | Backend |
|---|---|
| Chat / Writer | Erebus backend `:8000` (only if it has a real LLM) → Ollama `:11434` → NVIDIA (`gpt-oss-20b`, then deepseek-v4.1-flash, then nemotron-3.5) |
| Image | NVIDIA FLUX.1-dev → FLUX.1-schnell |
| Sound | Kokoro TTS `:8880` (WAV download) |
| Video | Nothing in the stack yet. Shows live status and never fakes output |
- NVIDIA goes through a Vite dev proxy (`/nvidia-llm`, `/nvidia-genai`). The key is injected server-side and is never bundled.
- The quick chat used to POST to a non-existent `/api/llm`, and the worker only returns a mock. It now uses the stack.

## Voice wiring
- `useErebusVoice(faceRef, voice, speed, volume)` → Kokoro `/tts` → `face.speak(url, volume)`. It falls back to `speechSynthesis`.
- Mute, voice, speed, and volume live in the store and are saved. Replies are spoken when "Speak replies" is on.
- Push-to-talk (hold) on the avatar controls and in chat uses browser SpeechRecognition (Chrome/Edge).

## Detach (optional, built)
- Uses Document Picture-in-Picture: `requestWindow()`, copies the stylesheets, then moves the live node. Face, audio, and voice queue keep running.
- Limits: Chromium only; needs a click; closes when the tab closes. It's always on top of other apps, not only the browser.
- Fallback is the floating in-page window. Effort: about 0.5 day (done).

## Persistence (Supabase first; localStorage is only a cache)
- New `public.app_settings(owner_id, key, value)` with RLS on `owner_id = app_owner_id()`.
- Dock settings go to `erebus_dock_settings`, chat to `erebus_dock_chat` (last 60 messages), plus `banner_url` and `logo_url`. Values that only exist locally are uploaded on first load.
- Bug fixed: `unifiedStorage` wrote to `user_settings.user_id`, a column that doesn't exist, so every Supabase save failed silently.
- **Owner-stable data** (migration `0007`): `owner_links` maps any anonymous session to one owner uid. `claim_owner(code)` checks a SHA-256 of the owner code. New `keys_*_owner` policies were **added**; old policies and all key rows are untouched.

## Phases (all done)
1. DB migration and owner link. 2. Storage fixes (unifiedStorage, banner, logo, keys). 3. Avatar host, skins, stage, float. 4. Voice and modes. 5. PiP. 6. Headless verification.

## Risks
- If Ollama or the Erebus backend is offline, chat falls through to NVIDIA and works only while the dev server proxy is running. A production build has no proxy.
- NVIDIA model availability changes (llama-3.3-70b hit end of life on 2026-08-26). The model list is in `erebusStack.ts`.
- Browser SpeechRecognition uses Google's servers (free, not local). A local Whisper would replace it.
- The Erebus portrait's feature boxes are tuned for `Erebus.png` only.

## Open questions
1. Video: which local model and workflow (ComfyUI with Wan or LTX)?
2. The stage shows on every page by default. Keep it that way or only on the dashboard?
3. For a production NVIDIA and Ollama path, add a worker route (key server-side) or stay local-only?

## Global navy/neon glass restyle (estimate, not built)
- Theme tokens (`--background`, `--primary`, glass blur/border, glow) in `index.css`/Tailwind 4 `@theme`: about 0.5 day.
- Shared card/panel primitives (`glass`, `PanelLayout`, `Card`, `Button`): about 1 day.
- Per-panel pass (about 30 panels with inline oklch crimson styles, e.g. Integrations): about 3–5 days.
- Total **about 5–7 days**. Low risk if done tokens-first, behind a theme switch.
