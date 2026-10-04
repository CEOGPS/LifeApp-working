// ============================================================================
// src/lib/agents/erebus/index.ts
//
// Public barrel for the Erebus agent module.
//
// Exports ONLY what actually lives under src/lib/agents/erebus/.
// The following are NOT under this folder and must be imported by their real
// paths from consumers:
//
//   - InitiationEngine (and any TriggerRegistry / PersonalityFilter /
//     EmotionManager):  src/lib/agents/initiation/*
//   - ErebusPresence:     src/components/lifeos/panels/ErebusPresence.tsx
//   - Erebus types:       src/lib/agents/types/*  (or wherever they live)
//   - useErebus hook:     TBD — confirm the real path before re-exporting
//   - storage utils:      TBD — confirm the real path before re-exporting
//
// Re-exporting those from here would produce a broken import graph, because
// relative resolution from THIS file will not find them.
// ============================================================================

// ── Core engine ──────────────────────────────────────────────────────────────
export {
  default as ErebusCore,
  getErebusCore,
  LS_KEYS,
  ER_PREFIX,
  WORKER,
  BACKEND,
  BROWSER_AGENT,
  OLLAMA,
} from "./ErebusCore";

// ── Orchestration loop ───────────────────────────────────────────────────────
export {
  runAgenticTask,
  runTaskSync,
  runSingleTurn,
  syncToBackend,
} from "./ErebusAgent";

// ── Tool execution ───────────────────────────────────────────────────────────
export {
  parseAndRunErebusTools,
  runErebusExecution,
  runErebusToolConfirmed,
} from "./ErebusTools";

// ── Media generation ─────────────────────────────────────────────────────────
export {
  generateImage,
  editImage,
  generateMusic,
  generateSpeech,
  generateVideo,
  imageToVideo,
  generateAvatar,
  revokeMediaUrl,
} from "./ErebusMedia";

// ── Local in-browser model (WebLLM / WebGPU) ─────────────────────────────────
export {
  LOCAL_MODELS,
  isSupported as isLocalModelSupported,
  loadLocalModel,
  unloadLocalModel,
  localModelChat,
  localModelChatStream,
  onLocalModelStatus,
  getLocalModelStatus,
  dispose as disposeLocalModel,
} from "./ErebusLocalModel";