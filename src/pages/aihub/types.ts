// src/pages/aihub/types.ts
// ============================================================================
// AI Hub — Type definitions
//
// Single source of truth for the hub. Every shape here matches something
// already used by AgentDock.jsx, ErebusCore.ts, or cloudflare-worker.js.
// Nothing is invented. If a field isn't read by an existing consumer, it's
// marked "hub-only" so we know it's for the hub UI alone.
// ============================================================================

// ── Agent type discriminant ──────────────────────────────────────────────────
// - "autonomous": has its own runtime (ErebusCore / Kranos). Talks to a backend.
// - "worker": routes through the Cloudflare Worker /api/llm/invoke. Stateless.
// - "model-backend": a model slot (Hermes, Qwen). No runtime until wired.
export type AgentType = "autonomous" | "worker" | "model-backend";

// ── Avatar ───────────────────────────────────────────────────────────────────
// Emoji OR Lucide icon name OR image URL. Exactly one is expected to be set;
// resolution order is: img > emoji > iconName > first letter of name.
export interface AgentAvatar {
  /** Image URL or /public path. Optional. */
  img?: string;
  /** Emoji character. Optional. */
  emoji?: string;
  /** Lucide icon name (e.g. "Bot", "Sparkles"). Optional. */
  iconName?: string;
  /** CSS object-position for img (e.g. "50% 15%"). Optional. */
  facePos?: string;
}

// ── Voice ────────────────────────────────────────────────────────────────────
// Two independent fields. tone is a descriptor shown in the UI.
// ttsVoiceId maps to an ElevenLabs voice ID (see ErebusMedia.ts EL_VOICES).
export interface AgentVoice {
  /** Human-readable tone ("deep, controlled", "warm, playful"). */
  tone: string;
  /** ElevenLabs voice ID. Empty string means "use default". */
  ttsVoiceId: string;
  /** SpeechSynthesis rate (0.5–2.0). Default 1.05. */
  rate: number;
  /** SpeechSynthesis pitch (0–2). Default 1.0. */
  pitch: number;
}

// ── Knowledge entry ──────────────────────────────────────────────────────────
// A single fact/document the agent knows. Lighter than memories.
export interface AgentKnowledge {
  id: string;
  label: string;
  content: string;
  /** Optional source URL. */
  source?: string;
}

// ── Memory entry ─────────────────────────────────────────────────────────────
// Long-term memory. Stored in lifeos_agents[agentId].memories. Separate from
// ErebusCore's own lifeos_er_lt.facts (which stays untouched).
export interface AgentMemory {
  id: string;
  text: string;
  /** ISO timestamp. */
  createdAt: string;
}

// ── Instruction ──────────────────────────────────────────────────────────────
export interface AgentInstruction {
  id: string;
  text: string;
}

// ── Assignment ───────────────────────────────────────────────────────────────
// Task assigned to an agent. Stored in lifeos1_aihub_assignments (KV-mirrored).
export type AssignmentStatus = "pending" | "active" | "blocked" | "done" | "cancelled";
export type AssignmentPriority = "low" | "normal" | "high" | "urgent";

export interface AgentAssignment {
  id: string;
  title: string;
  notes: string;
  assigneeId: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
  /** ISO timestamp or null. */
  dueAt: string | null;
}

// ── Agent ────────────────────────────────────────────────────────────────────
// The full agent record. Stored as lifeos_agents[agentId]. Every field the
// existing consumers read is preserved: name, tagline, color, img, facePos,
// systemPrompt, speechVoice, speechRate, speechPitch.
export interface Agent {
  // Identity
  id: string;
  name: string;
  tagline: string;
  role: string;
  type: AgentType;

  // Appearance
  color: string;              // hex string. Matches COLOR_OPTIONS in ErebusDock.tsx
  avatar: AgentAvatar;

  // Personality / soul
  personality: string;        // short descriptor
  soul: string;               // multi-paragraph identity
  story: string;              // brief backstory

  // Capabilities
  skills: string[];
  knowledge: AgentKnowledge[];
  memories: AgentMemory[];
  instructions: AgentInstruction[];

  // Voice
  voice: AgentVoice;

  // System prompt (read by AgentDock.jsx and Worker calls)
  systemPrompt: string;

  // Model preference (agent-level override; falls back to global)
  model: string;

  // Hierarchy
  parentId: string | null;    // null = top of tree
  hierarchyRole: string;      // "commander" | "primary" | "sub" | "skin"

  // Status (hub-only display; runtime state comes from the agent's own code)
  enabled: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ── Messaging bridge ─────────────────────────────────────────────────────────
// One row per platform binding. Maps to Supabase table platform_tokens via the
// Cloudflare Worker. New bridges persist to lifeos1_aihub_messaging.
export type MessagingPlatform = "telegram" | "google-voice" | "messenger" | "instagram";

export interface MessagingBridge {
  id: string;
  platform: MessagingPlatform;
  label: string;              // user-facing name ("Main Telegram Bot")
  /** Which agent handles inbound messages. */
  agentId: string;
  /** Supabase platform_tokens.user_id this bridge belongs to. Empty until connected. */
  userId: string;
  /** Whether the bridge is currently active. */
  active: boolean;
  /** Last known connection status from the Worker. */
  status: "connected" | "disconnected" | "unknown";
  createdAt: string;
  updatedAt: string;
}

// ── Worker ───────────────────────────────────────────────────────────────────
// One row per Cloudflare Worker endpoint. Seeded with lifeos1-api.
export interface CloudflareWorker {
  id: string;
  name: string;
  url: string;
  /** Which agent this worker primarily serves. Empty = shared. */
  agentId: string;
  /** Which bridge this worker handles. Empty = none. */
  bridgeId: string;
  /** Assigned role / duty (e.g. api calls, mail). Hub + Task Monitor. */
  role: string;
  /** Last health probe result. */
  status: "online" | "offline" | "unknown";
  /** ISO timestamp of last probe. */
  lastProbe: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Hierarchy node (derived, not stored) ─────────────────────────────────────
// Built at render time from Agent.parentId. Not persisted.
export interface HierarchyNode {
  agent: Agent;
  children: HierarchyNode[];
}

// ── Root shape for lifeos_agents ─────────────────────────────────────────────
// The localStorage value. Keyed by agent id. Matches what AgentDock.jsx
// getAgentOverride() reads (it does JSON.parse(localStorage.lifeos_agents || "{}")).
export type AgentsMap = Record<string, Agent>;

// ── Root shape for lifeos1_aihub_assignments ─────────────────────────────────
export interface AssignmentsState {
  assignments: AgentAssignment[];
}

// ── Root shape for lifeos1_aihub_messaging ───────────────────────────────────
export interface MessagingState {
  bridges: MessagingBridge[];
}

// ── Root shape for lifeos1_aihub_workers ─────────────────────────────────────
export interface WorkersState {
  workers: CloudflareWorker[];
}

// ── Section identifiers (used by AIHubPage tab router) ───────────────────────
export type HubSection =
  | "erebus"
  | "kranos"
  | "agents"
  | "messaging"
  | "workers"
  | "hermes"
  | "qwen"
  | "hierarchy"
  | "assignments";

// ── Seed data ────────────────────────────────────────────────────────────────
// Empty by design. The real seed lives in storage.ts (loadAgents) so this
// file stays pure types. No fake agents, no fake workers, no fake bridges.

// ── Discriminated helpers ────────────────────────────────────────────────────
export function isAutonomousAgent(a: Agent): boolean {
  return a.type === "autonomous";
}

export function isWorkerAgent(a: Agent): boolean {
  return a.type === "worker";
}

export function isModelBackendAgent(a: Agent): boolean {
  return a.type === "model-backend";
}