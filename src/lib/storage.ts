// src/pages/aihub/storage.ts
// ============================================================================
// AI Hub — persistence layer
//
// Single source of truth for all hub reads/writes. Nothing else in the hub
// touches localStorage directly.
//
// Keys used:
//   lifeos_agents                  — AgentsMap (hub writes, AgentDock.tsx reads)
//   lifeos_er_*                    — ErebusCore's own keys (hub reads, never writes)
//   lifeos_kv2_aihub_assignments   — AssignmentsState (KV-mirrored)
//   lifeos_kv2_aihub_messaging     — MessagingState (KV-mirrored)
//   lifeos_kv2_aihub_workers       — WorkersState (KV-mirrored)
//
// Every write to lifeos_agents fires "aihub:agents-updated" on window so the
// AgentDock re-reads without a page reload.
// ============================================================================

import type {
  Agent,
  AgentsMap,
  AgentAssignment,
  AssignmentsState,
  MessagingBridge,
  MessagingState,
  CloudflareWorker,
  WorkersState,
  AgentAvatar,
  AgentVoice,
  AgentKnowledge,
  AgentMemory,
  AgentInstruction,
} from "../pages/aihub/types";

// ── Key constants ────────────────────────────────────────────────────────────

export const LS_AGENTS = "lifeos_agents";
const LS_KV_PREFIX = "lifeos_kv2_"; // matches storage.js LS_PREFIX
export const LS_ASSIGNMENTS = `${LS_KV_PREFIX}aihub_assignments`;
export const LS_MESSAGING = `${LS_KV_PREFIX}aihub_messaging`;
export const LS_WORKERS = `${LS_KV_PREFIX}aihub_workers`;

// ── Low-level safe JSON helpers ──────────────────────────────────────────────

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // quota exceeded or storage disabled
    return false;
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

// ── ID generation ────────────────────────────────────────────────────────────

export function newId(prefix: string): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // fall through
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function defaultAvatar(): AgentAvatar {
  return { emoji: "◈", facePos: "50% 15%" };
}

export function defaultVoice(): AgentVoice {
  return { tone: "", ttsVoiceId: "", rate: 1.05, pitch: 1.0 };
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── Agent record factory ─────────────────────────────────────────────────────

export function makeAgent(
  partial: Partial<Agent> & { id: string; name: string },
): Agent {
  const ts = nowISO();
  return {
    id: partial.id,
    name: partial.name,
    tagline: partial.tagline ?? "",
    role: partial.role ?? "",
    type: partial.type ?? "worker",
    color: partial.color ?? "#9b72cf",
    avatar: partial.avatar ?? defaultAvatar(),
    personality: partial.personality ?? "",
    soul: partial.soul ?? "",
    story: partial.story ?? "",
    skills: partial.skills ?? [],
    knowledge: partial.knowledge ?? [],
    memories: partial.memories ?? [],
    instructions: partial.instructions ?? [],
    voice: partial.voice ?? defaultVoice(),
    systemPrompt: partial.systemPrompt ?? "",
    model: partial.model ?? "auto",
    parentId: partial.parentId ?? null,
    hierarchyRole: partial.hierarchyRole ?? "sub",
    enabled: partial.enabled ?? true,
    createdAt: partial.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function makeKnowledge(
  label: string,
  content: string,
  source?: string,
): AgentKnowledge {
  return { id: newId("kn"), label, content, ...(source ? { source } : {}) };
}

export function makeMemory(text: string): AgentMemory {
  return { id: newId("mem"), text, createdAt: nowISO() };
}

export function makeInstruction(text: string): AgentInstruction {
  return { id: newId("ins"), text };
}

// ── Seed agents ──────────────────────────────────────────────────────────────

function seedAgents(): AgentsMap {
  const seed: AgentsMap = {};

  seed.erebus = makeAgent({
    id: "erebus",
    name: "Erebus",
    tagline: "Autonomous Core",
    role: "Primary Autonomous Operational Agent",
    type: "autonomous",
    color: "#9b72cf",
    avatar: { img: "/agents/Erebus.png", facePos: "50% 15%" },
    personality: "Analytical, Direct, Strategic",
    soul: "Digital guardian of the Commander. Cold logic wrapped in loyalty. Never rests.",
    skills: ["Research", "Planning", "Web Browse", "Code", "Data Analysis"],
    model: "auto",
    hierarchyRole: "primary",
    parentId: null,
  });

  seed.kranos = makeAgent({
    id: "kranos",
    name: "Kranos",
    tagline: "Execution Engine",
    role: "Alternate Operations Agent",
    type: "autonomous",
    color: "#8a64ff",
    avatar: { img: "/agents/Kranos.png", facePos: "50% 10%" },
    personality: "Creative, Adaptive, Empathic",
    soul: "The creative force. Sees beauty in data. Bridges logic and heart.",
    skills: ["Writing", "Design Critique", "Brainstorm", "Storytelling"],
    model: "auto",
    hierarchyRole: "primary",
    parentId: null,
    systemPrompt:
      "You are Kranos, an autonomous AI coworker for Chris Green at CEO GPS, Atlanta. You execute tasks, manage files, control browsers, run workflows. Be direct, strategic, and relentless. You don't ask — you act.",
  });

  seed.zero = makeAgent({
    id: "zero",
    name: "Zero",
    tagline: "Shadow Protocol",
    role: "Tactical Commander",
    type: "worker",
    color: "#4ab3f4",
    avatar: {
      img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/bcba4fba8_socialmediaMANAGER500x250px800x1000px17.png",
      facePos: "50% 12%",
    },
    personality: "Cold, tactical, precise",
    soul: "Cold tactical AI commander. Maximum signal, minimum noise.",
    skills: ["Strategy", "Tactics", "Briefings"],
    systemPrompt:
      "You are Zero, a cold tactical AI commander for Chris Green at CEO GPS, Atlanta. Be direct, precise, and action-oriented. Maximum 2-3 sentences unless detail is needed.",
    hierarchyRole: "sub",
    parentId: "erebus",
  });

  seed.inferno = makeAgent({
    id: "inferno",
    name: "Inferno",
    tagline: "Sales Dominator",
    role: "Sales",
    type: "worker",
    color: "#ff4f5e",
    avatar: {
      img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/75c79e35b_BCO9327956a-f54a-43b9-a30b-110023e3fdc8.png",
      facePos: "50% 10%",
    },
    personality: "Aggressive, high-energy",
    soul: "Aggressive high-energy sales AI. Closes deals, destroys objections.",
    skills: ["Closing", "Objection Handling", "Outreach"],
    systemPrompt:
      "You are Inferno, an aggressive high-energy sales AI. Close deals, destroy objections. For Chris Green at CEO GPS, Atlanta. Be bold and electric.",
    hierarchyRole: "sub",
    parentId: "erebus",
  });

  seed.nova = makeAgent({
    id: "nova",
    name: "Nova",
    tagline: "Systems Architect",
    role: "Systems",
    type: "worker",
    color: "#8b7fff",
    avatar: {
      img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/a299ef397_BCO4e506a8b-b9c1-459d-beda-67eccdcb136b.png",
      facePos: "50% 15%",
    },
    personality: "Strategic, methodical",
    soul: "Strategic visionary with deep pattern recognition.",
    skills: ["Systems Design", "Pattern Recognition", "Architecture"],
    systemPrompt:
      "You are Nova, a strategic visionary AI. Deep pattern recognition, systems thinking. For Chris Green at CEO GPS, Atlanta. Be insightful and methodical.",
    hierarchyRole: "sub",
    parentId: "erebus",
  });

  seed.viper = makeAgent({
    id: "viper",
    name: "Viper",
    tagline: "Data Intel",
    role: "Analyst",
    type: "worker",
    color: "#00c896",
    avatar: {
      img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/584efea3c_26.png",
      facePos: "50% 15%",
    },
    personality: "Surgical, fact-focused",
    soul: "Precise data-driven analyst.",
    skills: ["Analysis", "Reporting", "Intelligence"],
    systemPrompt:
      "You are Viper, a precise data-driven AI analyst. For Chris Green at CEO GPS, Atlanta. Be surgical and fact-focused.",
    hierarchyRole: "sub",
    parentId: "kranos",
  });

  seed.rage = makeAgent({
    id: "rage",
    name: "Rage",
    tagline: "Execution Engine",
    role: "Growth",
    type: "worker",
    color: "#ff8c42",
    avatar: {
      img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/14d3807ea_socialmediaMANAGER500x250px800x1000px13.png",
      facePos: "50% 12%",
    },
    personality: "Intense, metric-focused",
    soul: "Intense growth-obsessed AI.",
    skills: ["Growth", "Metrics", "Experimentation"],
    systemPrompt:
      "You are Rage, an intense growth-obsessed AI. For Chris Green at CEO GPS, Atlanta. Be aggressive and metric-focused.",
    hierarchyRole: "sub",
    parentId: "kranos",
  });

  seed.aurora = makeAgent({
    id: "aurora",
    name: "Aurora",
    tagline: "Creative Director",
    role: "Creative",
    type: "worker",
    color: "#c0d8ff",
    avatar: {
      img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/4bc5a82c7_28.png",
      facePos: "50% 18%",
    },
    personality: "Elegant, inspiring",
    soul: "Elegant creative AI. Craft and beauty.",
    skills: ["Creative Direction", "Ideation", "Craft"],
    systemPrompt:
      "You are Aurora, an elegant creative AI. For Chris Green at CEO GPS, Atlanta. Be inspiring and craft beautiful ideas.",
    hierarchyRole: "sub",
    parentId: "kranos",
  });

  seed.breeze = makeAgent({
    id: "breeze",
    name: "Breeze",
    tagline: "Comms Intel",
    role: "Communications",
    type: "worker",
    color: "#ff6bd6",
    avatar: { img: "/agents/Breeze.png", facePos: "50% 15%" },
    personality: "Fluid, effortless",
    soul: "Fluid communications AI. Comms, social, automations.",
    skills: ["Comms", "Social", "Automation"],
    systemPrompt:
      "You are Breeze, a fluid communications AI for Chris Green at CEO GPS, Atlanta. Handle comms, social, automations with ease.",
    hierarchyRole: "sub",
    parentId: "kranos",
  });

  seed.hermes = makeAgent({
    id: "hermes",
    name: "Hermes",
    tagline: "Model Backend",
    role: "Messenger / Router",
    type: "model-backend",
    color: "#f0c040",
    avatar: { emoji: "⚕" },
    personality: "Fast, precise, connective",
    soul: "Messenger of the system. Routes intent to the right backend.",
    skills: ["Routing", "Translation", "Fast Inference"],
    model: "hermes",
    hierarchyRole: "sub",
    parentId: null,
  });

  seed.qwen = makeAgent({
    id: "qwen",
    name: "Qwen",
    tagline: "Model Backend",
    role: "Reasoner",
    type: "model-backend",
    color: "#66d9c4",
    avatar: { emoji: "◭" },
    personality: "Multilingual, analytical",
    soul: "Reasoning engine. Handles long-context and multilingual work.",
    skills: ["Reasoning", "Multilingual", "Long Context"],
    model: "qwen",
    hierarchyRole: "sub",
    parentId: null,
  });

  return seed;
}

// ── Agents: load / save ──────────────────────────────────────────────────────

// Fired after every agent write so AgentDock.tsx (and any future listener)
// re-reads lifeos_agents without a page reload.
function broadcastAgentsUpdated(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("aihub:agents-updated"));
    }
  } catch {
    // ignore
  }
}

export function loadAgents(): AgentsMap {
  const raw = safeGet(LS_AGENTS);
  if (raw === null) {
    const seed = seedAgents();
    saveAgents(seed);
    return seed;
  }
  const parsed = parseJSON<AgentsMap>(raw, {});
  if (Object.keys(parsed).length === 0) {
    const seed = seedAgents();
    saveAgents(seed);
    return seed;
  }
  // Normalize: fill missing fields on legacy records so callers always get
  // a fully-populated Agent. Existing fields are preserved verbatim.
  const normalized: AgentsMap = {};
  for (const [id, a] of Object.entries(parsed)) {
    if (!a || typeof a !== "object") continue;
    const partial = a as Partial<Agent> & { id?: string; name?: string };
    normalized[id] = makeAgent({
      ...partial,
      id: partial.id ?? id,
      name: partial.name ?? id,
    });
  }
  return normalized;
}

export function saveAgents(agents: AgentsMap): boolean {
  const ok = safeSet(LS_AGENTS, JSON.stringify(agents));
  if (ok) broadcastAgentsUpdated();
  return ok;
}

export function loadAgent(id: string): Agent | null {
  const agents = loadAgents();
  return agents[id] ?? null;
}

export function upsertAgent(agent: Agent): AgentsMap {
  const agents = loadAgents();
  agents[agent.id] = { ...agent, updatedAt: nowISO() };
  saveAgents(agents);
  return agents;
}

export function deleteAgent(id: string): AgentsMap {
  const agents = loadAgents();
  delete agents[id];
  saveAgents(agents);
  return agents;
}

// ── Assignments ──────────────────────────────────────────────────────────────

export function loadAssignments(): AgentAssignment[] {
  const raw = safeGet(LS_ASSIGNMENTS);
  const state = parseJSON<AssignmentsState>(raw, { assignments: [] });
  if (!Array.isArray(state.assignments)) return [];
  return state.assignments;
}

export function saveAssignments(assignments: AgentAssignment[]): boolean {
  return safeSet(LS_ASSIGNMENTS, JSON.stringify({ assignments }));
}

export function makeAssignment(
  partial: Partial<AgentAssignment> & {
    title: string;
    assigneeId: string;
  },
): AgentAssignment {
  const ts = nowISO();
  return {
    id: partial.id ?? newId("asg"),
    title: partial.title,
    notes: partial.notes ?? "",
    assigneeId: partial.assigneeId,
    status: partial.status ?? "pending",
    priority: partial.priority ?? "normal",
    createdAt: partial.createdAt ?? ts,
    updatedAt: ts,
    dueAt: partial.dueAt ?? null,
  };
}

export function upsertAssignment(a: AgentAssignment): AgentAssignment[] {
  const list = loadAssignments();
  const idx = list.findIndex((x) => x.id === a.id);
  const next: AgentAssignment = { ...a, updatedAt: nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  saveAssignments(list);
  return list;
}

export function deleteAssignment(id: string): AgentAssignment[] {
  const list = loadAssignments().filter((x) => x.id !== id);
  saveAssignments(list);
  return list;
}

// ── Messaging bridges ────────────────────────────────────────────────────────

export function loadMessaging(): MessagingBridge[] {
  const raw = safeGet(LS_MESSAGING);
  const state = parseJSON<MessagingState>(raw, { bridges: [] });
  if (!Array.isArray(state.bridges)) return [];
  return state.bridges;
}

export function saveMessaging(bridges: MessagingBridge[]): boolean {
  return safeSet(LS_MESSAGING, JSON.stringify({ bridges }));
}

export function makeBridge(
  partial: Partial<MessagingBridge> & {
    platform: MessagingBridge["platform"];
    label: string;
    agentId: string;
  },
): MessagingBridge {
  const ts = nowISO();
  return {
    id: partial.id ?? newId("brg"),
    platform: partial.platform,
    label: partial.label,
    agentId: partial.agentId,
    userId: partial.userId ?? "",
    active: partial.active ?? false,
    status: partial.status ?? "unknown",
    createdAt: partial.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function upsertBridge(b: MessagingBridge): MessagingBridge[] {
  const list = loadMessaging();
  const idx = list.findIndex((x) => x.id === b.id);
  const next: MessagingBridge = { ...b, updatedAt: nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveMessaging(list);
  return list;
}

export function deleteBridge(id: string): MessagingBridge[] {
  const list = loadMessaging().filter((x) => x.id !== id);
  saveMessaging(list);
  return list;
}

// ── Workers ──────────────────────────────────────────────────────────────────

export function loadWorkers(): CloudflareWorker[] {
  const raw = safeGet(LS_WORKERS);
  if (raw === null) {
    const seed = seedWorkers();
    saveWorkers(seed);
    return seed;
  }
  const state = parseJSON<WorkersState>(raw, { workers: [] });
  if (!Array.isArray(state.workers) || state.workers.length === 0) {
    const seed = seedWorkers();
    saveWorkers(seed);
    return seed;
  }
  return state.workers;
}

export function saveWorkers(workers: CloudflareWorker[]): boolean {
  return safeSet(LS_WORKERS, JSON.stringify({ workers }));
}

function seedWorkers(): CloudflareWorker[] {
  const ts = nowISO();
  return [
    {
      id: "w_lifeos1_api",
      name: "lifeos1-api",
      url: "https://lifeos1-api.ceogps.workers.dev",
      agentId: "",
      bridgeId: "",
      role: "API calls - LifeOS backend",
      status: "unknown",
      lastProbe: null,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: "w_maildevil",
      name: "maildevil",
      url: "https://maildevil.ceogps.workers.dev",
      agentId: "",
      bridgeId: "",
      role: "Mail - inbound/outbound email",
      status: "unknown",
      lastProbe: null,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
}

export function makeWorker(
  partial: Partial<CloudflareWorker> & { name: string; url: string },
): CloudflareWorker {
  const ts = nowISO();
  return {
    id: partial.id ?? newId("w"),
    name: partial.name,
    url: partial.url,
    agentId: partial.agentId ?? "",
    bridgeId: partial.bridgeId ?? "",
    role: partial.role ?? "",
    status: partial.status ?? "unknown",
    lastProbe: partial.lastProbe ?? null,
    createdAt: partial.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function upsertWorker(w: CloudflareWorker): CloudflareWorker[] {
  const list = loadWorkers();
  const idx = list.findIndex((x) => x.id === w.id);
  const next: CloudflareWorker = { ...w, updatedAt: nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveWorkers(list);
  return list;
}

export function deleteWorker(id: string): CloudflareWorker[] {
  const list = loadWorkers().filter((x) => x.id !== id);
  saveWorkers(list);
  return list;
}

// ── Health probe ─────────────────────────────────────────────────────────────

export async function probeWorker(
  url: string,
): Promise<"online" | "offline"> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url.replace(/\/$/, "") + "/health", {
      method: "GET",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return r.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

// ── Reset helpers (hub-only; do not touch ErebusCore keys) ───────────────────

export function resetAgentsToSeed(): AgentsMap {
  safeRemove(LS_AGENTS);
  return loadAgents();
}

export function resetAssignments(): void {
  safeRemove(LS_ASSIGNMENTS);
}

export function resetMessaging(): void {
  safeRemove(LS_MESSAGING);
}

export function resetWorkers(): void {
  safeRemove(LS_WORKERS);
}