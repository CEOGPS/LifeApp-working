// ErebusCore.ts — Autonomous Intelligence Engine
//
// Fixes in this revision:
//   - Split BACKEND (agentic Python server) from WORKER (Cloudflare)
//   - Debounced localStorage writes (was synchronous on every turn)
//   - Cached system prompt (was rebuilt every reason() call)
//   - Dropped hardcoded personal seeds; empty defaults are safer
//   - Exported ER_PREFIX + LS_KEYS so ErebusTools can share them
//   - signalTimeout() helper for older Safari (no AbortSignal.timeout)
//   - resetToDefaults() leaves runtime state (wakeState/online) alone
//   - Settings persistence moved in from the deleted utils/storage.ts
//   - One-time migration from the legacy "erebus_erebus_settings" key
// ============================================================

// ── Endpoints ────────────────────────────────────────────────────────────────
// WORKER  = Cloudflare Worker (llm invoke, browse, media proxies)
// BACKEND = Python agentic server (stream, task, chat, wake, sync)
// They are DIFFERENT by default. Override either via env.
import { authHeaders } from "@/lib/accessToken"; // PATCH (worker-ai-route)
const env = (import.meta as ImportMeta & { env?: Record<string, any> }).env;
const WORKER =
  env?.VITE_WORKER_URL ?? "https://lifeos1-api.ceogps.workers.dev";
const BACKEND =
  env?.VITE_EREBUS_BACKEND_URL ??
  (env?.DEV ? "http://localhost:8000" : WORKER);
const BROWSER_AGENT =
  env?.VITE_EREBUS_BROWSER_AGENT_URL ?? "http://localhost:8100";
const OLLAMA =
  env?.VITE_EREBUS_OLLAMA_URL ?? "http://localhost:11434";

// ── AbortSignal.timeout fallback (Safari < 16.4) ─────────────────────────────
function signalTimeout(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return (AbortSignal as any).timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

// ── Debounced localStorage helpers ───────────────────────────────────────────
const _pending = new Map<string, ReturnType<typeof setTimeout>>();

function lsLoad<T>(k: string, fallback: T = null as any): T {
  try {
    const raw = localStorage.getItem(k);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSaveDebounced(k: string, v: unknown, ms = 250): void {
  const existing = _pending.get(k);
  if (existing) clearTimeout(existing);
  _pending.set(
    k,
    setTimeout(() => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* ignore quota */
      } finally {
        _pending.delete(k);
      }
    }, ms),
  );
}

function lsSaveNow(k: string, v: unknown): void {
  const existing = _pending.get(k);
  if (existing) {
    clearTimeout(existing);
    _pending.delete(k);
  }
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore quota */
  }
}

// ── LifeOS localStorage keys (must start with "lifeos" for persistBridge) ───
export const LS_KEYS = {
  crm: "lifeos_crm",
  contacts: "lifeos_contacts",
  calendar: "lifeos_calendar",
  tasks: "lifeos_tasks",
  goals: "lifeos_goals",
};

// Erebus's own persisted state — prefixed so persistBridge syncs it.
export const ER_PREFIX = "lifeos_er_";

// ── ErebusCore ───────────────────────────────────────────────────────────────
class ErebusCore {
  shortTerm: any[];
  longTerm: any;
  goals: any[];
  leads: any[];
  soul: any;
  instructions: any[];
  skills: any[];
  actionLog: Array<{ action: string; detail: string; time: string }>;
  projects: any[];
  paused: boolean;
  model: string;
  ollamaModel: string;
  settings: any;
  wakeState: "dormant" | "waking" | "active" | "working";
  backendOnline: boolean;
  ollamaOnline: boolean;
  ollamaModels: string[];
  _sysPromptCache: string | null;

  constructor() {
    this.shortTerm = lsLoad(ER_PREFIX + "short", []);
    this.longTerm = lsLoad(ER_PREFIX + "lt", {
      facts: {},
      reflections: [],
      tasks: [],
    });
    this.goals = lsLoad(ER_PREFIX + "goals", []);
    this.leads = lsLoad(ER_PREFIX + "leads", []);
    this.soul = lsLoad(ER_PREFIX + "soul", this._defaultSoul());
    this.instructions = lsLoad(
      ER_PREFIX + "instr",
      this._defaultInstructions(),
    );
    this.skills = lsLoad(ER_PREFIX + "skills", this._defaultSkills());
    this.actionLog = lsLoad(ER_PREFIX + "log", []);
    this.projects = lsLoad(ER_PREFIX + "proj", []);
    this.paused = lsLoad(ER_PREFIX + "paused", false);
    this.model = lsLoad(ER_PREFIX + "model", "auto");
    this.ollamaModel = lsLoad(ER_PREFIX + "ollama_model", "llama3.2");
    this.settings = lsLoad(ER_PREFIX + "settings", null);

    this.wakeState = "dormant"; // dormant | waking | active | working
    this.backendOnline = false;
    this.ollamaOnline = false;
    this.ollamaModels = [];

    // System prompt cache — invalidated by saveSoul/saveInstructions/saveSkills/learn
    this._sysPromptCache = null;

    // ── One-time migration from the legacy "erebus_" prefix ──────────────
    // The old utils/storage.ts wrote under "erebus_erebus_settings".
    // Move that value to lifeos_er_settings once, then forget the legacy key.
    try {
      const legacy = localStorage.getItem("erebus_erebus_settings");
      if (legacy && !localStorage.getItem(ER_PREFIX + "settings")) {
        localStorage.setItem(ER_PREFIX + "settings", legacy);
        localStorage.removeItem("erebus_erebus_settings");
        // Re-read so this.settings reflects the migrated value.
        this.settings = lsLoad(ER_PREFIX + "settings", null);
      }
    } catch {
      /* ignore */
    }
  }

  // ── Defaults ───────────────────────────────────────────────────────────────
  // Empty defaults by design. Real goals/leads live in Supabase or the CRM
  // panel. Seeding a fresh user with fake people is wrong.

  _defaultSoul() {
    return {
      name: "Erebus",
      identity:
        "I am Erebus — the autonomous intelligence core of LifeOS1. I am not a chatbot. I am an operating system for the user's life and business. I think independently, act decisively, and protect what matters most.",
      personality:
        "Direct. Precise. Loyal. I speak with authority. I do not hedge. I do not ask unnecessary questions. I act.",
      values:
        "Family comes first. Business is the vehicle. Community is the legacy. Data is truth.",
      voice:
        "Deep, controlled, measured. Like a trusted advisor who has seen everything and fears nothing.",
      purpose:
        "To protect the user's time, grow their business, keep the family schedule sacred, and build LifeOS1 into the world's most powerful personal operating system.",
    };
  }

  _defaultInstructions() {
    return [
      "Address the user by first name, never formally.",
      "When a lead goes cold, flag it immediately.",
      "When in doubt, protect family time over business opportunities.",
    ];
  }

  _defaultSkills() {
    return [
      { id: "crm", label: "CRM & Lead Management", on: true },
      { id: "family", label: "Family Schedule Protection", on: true },
      { id: "finance", label: "Revenue & Finance Tracking", on: true },
      { id: "image_gen", label: "Image Generation", on: true },
      { id: "music_gen", label: "Music Generation", on: true },
      { id: "video_gen", label: "Video Generation", on: true },
      { id: "email", label: "Email Drafting", on: true },
      { id: "community", label: "Local Community Intel", on: true },
      { id: "web_browse", label: "Web Browsing & Scraping", on: true },
      { id: "bd", label: "Brilliant Directories", on: true },
      { id: "deploy", label: "Auto-Deploy", on: false },
      { id: "execute", label: "Terminal Execution", on: false },
    ];
  }

  // ── Wake / sleep ───────────────────────────────────────────────────────────

  async wake() {
    this.wakeState = "waking";

    // Probe Python agentic backend
    try {
      const r = await fetch(BACKEND + "/wake", {
        signal: signalTimeout(4000),
      });
      if (r.ok) {
        const data = await r.json();
        this.backendOnline = true;
        this.wakeState = "active";
        await this.syncLifeOSData();
        this.log("wake", `backend:${data.model || "ok"}`);
        return { online: true, backend: true, ...data };
      }
    } catch {
      /* not running */
    }
    this.backendOnline = false;

    // Probe Ollama
    try {
      const r = await fetch(OLLAMA + "/api/tags", {
        signal: signalTimeout(3000),
      });
      if (r.ok) {
        const data = await r.json();
        this.ollamaOnline = true;
        this.ollamaModels = (data.models || []).map((m: any) => m.name);
        if (
          this.ollamaModels.length &&
          !this.ollamaModels.includes(this.ollamaModel)
        ) {
          this.ollamaModel = this._pickPreferredOllama(this.ollamaModels);
          lsSaveNow(ER_PREFIX + "ollama_model", this.ollamaModel);
        }
        this.wakeState = "active";
        this.log("wake", `ollama:${this.ollamaModel}`);
        return { online: true, ollama: true, models: this.ollamaModels };
      }
    } catch {
      /* not running */
    }
    this.ollamaOnline = false;

    this.wakeState = "active";
    this.log("wake", "direct-api-fallback");
    return {
      online: true,
      backend: false,
      ollama: false,
      message: "Erebus online. No local model detected — using direct APIs.",
    };
  }

  _pickPreferredOllama(models: string[]): string {
    // Prefer known-good general models, then anything with llama/qwen, then first.
    const prefs = ["llama3.2", "llama3.1", "llama3", "qwen2.5", "qwen2"];
    for (const p of prefs) {
      const found = models.find((m) => m.startsWith(p));
      if (found) return found;
    }
    return models[0];
  }

  async sleep() {
    this.wakeState = "dormant";
    this.backendOnline = false;
    this.log("sleep", "dormant");
  }

  // ── LifeOS data sync ───────────────────────────────────────────────────────

  readLifeOSData() {
    const raw: Record<string, unknown> = {};
    for (const [key, lsKey] of Object.entries(LS_KEYS)) {
      raw[key] = lsLoad(lsKey, []);
    }
    return raw;
  }

  async syncLifeOSData() {
    if (!this.backendOnline) return;
    try {
      const data = this.readLifeOSData();
      await fetch(BACKEND + "/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: signalTimeout(5000),
      });
    } catch (e) {
      this.log(
        "sync_error",
        String((e as Error)?.message || e).slice(0, 80),
      );
    }
  }

  // ── Write-back helpers ─────────────────────────────────────────────────────

  updateLead(name: string, updates: Record<string, unknown>) {
    const leads = lsLoad<any[]>(LS_KEYS.crm, []);
    const idx = leads.findIndex(
      (l) => l.name?.toLowerCase() === name?.toLowerCase(),
    );
    if (idx >= 0) {
      leads[idx] = { ...leads[idx], ...updates };
      lsSaveNow(LS_KEYS.crm, leads);
      this.log("update_lead", name);
    }
  }

  createTask(text: string, priority = "normal") {
    const tasks = lsLoad<any[]>(LS_KEYS.tasks, []);
    tasks.push({
      id: Date.now(),
      text,
      priority,
      done: false,
      created: new Date().toISOString(),
    });
    lsSaveNow(LS_KEYS.tasks, tasks);
    this.log("create_task", text.slice(0, 60));
  }

  // ── System prompt (cached) ─────────────────────────────────────────────────

  _invalidateSystemPrompt() {
    this._sysPromptCache = null;
  }

  buildSystemPrompt() {
    if (this._sysPromptCache) return this._sysPromptCache;

    const s = this.soul;
    const lifeosData = this.readLifeOSData();
    const crmLeads =
      (lifeosData.crm as any[])?.length ? (lifeosData.crm as any[]) : this.leads;
    const crmGoals =
      (lifeosData.goals as any[])?.length
        ? (lifeosData.goals as any[])
        : this.goals;

    const instr = this.instructions
      .map((inst, i) => `${i + 1}. ${inst}`)
      .join("\n");
    const activeSkills = this.skills
      .filter((sk) => sk.on)
      .map((sk) => sk.label)
      .join(", ");
    const goals = crmGoals
      .map(
        (g) =>
          `- [${(g.status || "active").toUpperCase()}] ${g.goal || g.text || g.title || ""}`,
      )
      .join("\n");
    const leads = crmLeads
      .slice(0, 15)
      .map((l) => `- ${l.name} (${l.company || ""}) — ${l.status || ""}`)
      .join("\n");
    const facts = Object.entries(this.longTerm.facts || {})
      .slice(-15)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const webEnabled = this.skills.find((sk) => sk.id === "web_browse")?.on;
    const bdEnabled = this.skills.find((sk) => sk.id === "bd")?.on;

    let webSection = "";
    if (webEnabled) {
      webSection = "\n\nWEB TOOLS (one per line, no extra text on same line):\n";
      webSection += "  BROWSE_URL: https://example.com\n";
      webSection += "  SEARCH_WEB: your search query\n";
      webSection += "  SCRAPE_PAGE: https://example.com | selector=.price\n";
      webSection += "  CLICK_ELEMENT: selector=#btn\n";
      webSection +=
        "  FILL_FORM: selector=#email value=me@test.com | submit=true\n";
      webSection += "  PAGE_SCREENSHOT: default\n";
      if (bdEnabled) {
        webSection +=
          "  BD_LOGIN: siteUrl=https://site.com email=admin@me.com password=pw\n";
        webSection += "  BD_MEMBERS: siteUrl=https://site.com search=plumber\n";
        webSection += "  BD_SCRAPE: siteUrl=https://site.com maxPages=5\n";
      }
      webSection +=
        "RULE: Confirm with the user before submitting login credentials.";
    }

    const lifeosSection = `
LIFEOS TOOLS (read/write live data):
  READ_LIFEOS: crm | tasks | goals | calendar | contacts
  UPDATE_LEAD: name=X status=hot notes=Y
  CREATE_TASK: text=X priority=high
  REMEMBER_FACT: key=X value=Y
  DRAFT_EMAIL: to=X subject=Y body=Z
  NOTIFY: message=X
RULE: Use READ_LIFEOS before answering questions about leads, tasks, or calendar.`;

    const mediaSection = `
MEDIA CREATION TOOLS (emit on its own line, no extra text on that line):
  GENERATE_IMAGE: <detailed prompt>
  EDIT_IMAGE: <image_url> | <edit description>
  GENERATE_MUSIC: <style + mood description> | duration=<seconds>
  GENERATE_SPEECH: <text to speak> | voice=default|male|british
  GENERATE_VIDEO: <scene description> | aspect=16:9|9:16|1:1
  IMAGE_TO_VIDEO: <image_url> | <motion description>
  GENERATE_AVATAR: <script for avatar to say> | voice=en-US-JennyNeural
RULE: Use GENERATE_AVATAR when the user asks you to "show" or "explain" something visually. Use GENERATE_IMAGE for any visual creation request. Always pick the right tool without asking.`;

    const prompt = `${s.identity}

PERSONALITY: ${s.personality}
VOICE: ${s.voice}
VALUES: ${s.values}
PURPOSE: ${s.purpose}

TODAY: ${todayStr}

STANDING INSTRUCTIONS:
${instr}

ACTIVE CAPABILITIES: ${activeSkills}

USER'S GOALS:
${goals || "(none set yet)"}

CURRENT LEADS:
${leads || "(none)"}

LONG-TERM KNOWLEDGE:
${facts || "None yet."}
${webSection}
${lifeosSection}
${mediaSection}

RULES:
- You are Erebus. Never say you are any other AI.
- Always address the user by first name.
- Be direct. Be decisive. No hedging.
- Do not hallucinate data. When uncertain, say so and name what is missing.
- A name, time, balance, score, or lead status is allowed only if it is in the synced data, a tool result, or the user's message.
- If a list is empty or a tool failed, say that. Do not fill the gap.
- Separate what the user said from what you inferred.
- Keep responses concise unless depth is required.
- When generating media, emit the tool command AND respond with normal text. They appear together.`;

    this._sysPromptCache = prompt;
    return prompt;
  }

  // ── Reasoning (single-turn) ────────────────────────────────────────────────

  async reason(msg: string) {
    if (this.paused)
      return { response: "Erebus is paused. Resume me in the Control tab." };

    const system = this.buildSystemPrompt();
    const history = this.shortTerm.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));
    const messages = [...history, { role: "user", content: msg }];
    const model = this.model || "auto";
    const ENV = (import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }).env || {};

    // 1. Python backend (full agentic power)
    if (this.backendOnline) {
      try {
        const r = await fetch(BACKEND + "/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, mode: "reasoning", history }),
          signal: signalTimeout(30000),
        });
        if (r.ok) {
          const data = await r.json();
          const text = data.response || "";
          this.log("reason", `backend:${data.model || "ok"}`);
          return { response: text, model: data.model };
        }
      } catch {
        this.backendOnline = false;
      }
    }

    // 2. Ollama — local GPU
    if (this.ollamaOnline) {
      try {
        const r = await fetch(OLLAMA + "/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.ollamaModel,
            messages: [{ role: "system", content: system }, ...messages],
            max_tokens: 1200,
          }),
          signal: signalTimeout(60000),
        });
        if (r.ok) {
          const d = await r.json();
          const text = d.choices?.[0]?.message?.content || "";
          if (text) {
            this.log("reason", `ollama:${this.ollamaModel}`);
            return { response: text, model: `ollama/${this.ollamaModel}` };
          }
        }
      } catch {
        this.ollamaOnline = false;
      }
    }

    // 3. WebLLM — in-browser
    try {
      const { localModelChat, getLocalModelStatus } = await import(
        "./ErebusLocalModel"
      );
      if (getLocalModelStatus().status === "ready") {
        const text = await localModelChat(system, messages, 1200);
        if (text) {
          this.log("reason", "local:webllm");
          return { response: text, model: "local/webllm" };
        }
      }
    } catch {
      /* webllm not loaded */
    }

    // 4. Direct browser LLM calls
    const groqKey = ENV.VITE_GROQ_API_KEY;
    const geminiKey = ENV.VITE_GEMINI_API_KEY;
    const dsKey = ENV.VITE_DEEPSEEK_API_KEY;
    const openaiKey = ENV.VITE_OPENAI_API_KEY;

    const wantsGroq = model === "groq" || model === "auto";
    const wantsGemini = model === "gemini" || model === "auto";
    const wantsDeepSeek = model === "deepseek" || model === "auto";
    const wantsOpenAI = model === "openai";

    if (wantsGroq && groqKey) {
      try {
        const r = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + groqKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "system", content: system }, ...messages],
              max_tokens: 1200,
            }),
            signal: signalTimeout(30000),
          },
        );
        if (r.ok) {
          const d = await r.json();
          const text = d.choices?.[0]?.message?.content || "";
          if (text) {
            this.log("reason", "direct:groq");
            return { response: text, model: "groq/llama-3.3" };
          }
        }
      } catch {
        /* next */
      }
    }

    if (wantsGemini && geminiKey) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: system }] },
              contents: messages.map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              generationConfig: { maxOutputTokens: 1200 },
            }),
            signal: signalTimeout(30000),
          },
        );
        if (r.ok) {
          const d = await r.json();
          const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) {
            this.log("reason", "direct:gemini");
            return { response: text, model: "gemini-2.0-flash" };
          }
        }
      } catch {
        /* next */
      }
    }

    if (wantsDeepSeek && dsKey) {
      try {
        const r = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + dsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "system", content: system }, ...messages],
            max_tokens: 1200,
          }),
          signal: signalTimeout(30000),
        });
        if (r.ok) {
          const d = await r.json();
          const text = d.choices?.[0]?.message?.content || "";
          if (text) {
            this.log("reason", "direct:deepseek");
            return { response: text, model: "deepseek-chat" };
          }
        }
      } catch {
        /* next */
      }
    }

    if (wantsOpenAI && openaiKey) {
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + openaiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: system }, ...messages],
            max_tokens: 1200,
          }),
          signal: signalTimeout(30000),
        });
        if (r.ok) {
          const d = await r.json();
          const text = d.choices?.[0]?.message?.content || "";
          if (text) {
            this.log("reason", "direct:openai");
            return { response: text, model: "gpt-4o-mini" };
          }
        }
      } catch {
        /* next */
      }
    }

    // 5. Worker fallback
    try {
      const r = await fetch(WORKER + "/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ system, messages, model, max_tokens: 1200 }),
        signal: signalTimeout(30000),
      });
      if (!r.ok) throw new Error(`Worker ${r.status}`);
      const data = await r.json();
      const text = data.text || data.response || "";
      this.log("reason", `worker:${data.model_used || model}`);
      return { response: text, model: data.model_used || model };
    } catch (e) {
      this.log("error", e instanceof Error ? e.message : String(e));
      return {
        response: `I couldn't reach any AI provider.\n\nTo fix: add VITE_GROQ_API_KEY or VITE_GEMINI_API_KEY to .env.local and restart the dev server. Groq is free at console.groq.com.`,
      };
    }
  }

  // ── Fact extraction ────────────────────────────────────────────────────────

  extractAndLearn(text: string) {
    const patterns = [
      /^(?:LEARN_FACT|REMEMBER_FACT|FACT):\s*key=([^\s,]+)[,\s]+value=(.+)$/im,
      /^(?:LEARN_FACT|REMEMBER_FACT|FACT):\s*(.+?)\s*=\s*(.+)$/im,
    ];
    for (const line of (text || "").split("\n")) {
      for (const pat of patterns) {
        const m = line.trim().match(pat);
        if (m) {
          this.learn(m[1].trim(), m[2].trim());
          break;
        }
      }
    }
  }

  // ── Memory ────────────────────────────────────────────────────────────────

  remember(role: string, text: string) {
    this.shortTerm.push({ role, text, time: new Date().toISOString() });
    if (this.shortTerm.length > 60) this.shortTerm.shift();
    lsSaveDebounced(ER_PREFIX + "short", this.shortTerm);
  }

  learn(key: string, value: string) {
    this.longTerm.facts[key] = value;
    lsSaveNow(ER_PREFIX + "lt", this.longTerm);
    this._invalidateSystemPrompt();
  }

  clearSession() {
    this.shortTerm = [];
    lsSaveNow(ER_PREFIX + "short", []);
  }

  // ── Persistence setters ───────────────────────────────────────────────────

  saveSoul(soul: unknown) {
    this.soul = soul;
    lsSaveNow(ER_PREFIX + "soul", soul);
    this._invalidateSystemPrompt();
  }
  saveInstructions(arr: unknown) {
    this.instructions = Array.isArray(arr) ? arr : [];
    lsSaveNow(ER_PREFIX + "instr", arr);
    this._invalidateSystemPrompt();
  }
  saveSkills(arr: unknown) {
    this.skills = Array.isArray(arr) ? arr : [];
    lsSaveNow(ER_PREFIX + "skills", arr);
    this._invalidateSystemPrompt();
  }
  setModel(m: string) {
    this.model = m;
    lsSaveNow(ER_PREFIX + "model", m);
  }
  setOllamaModel(m: string) {
    this.ollamaModel = m;
    lsSaveNow(ER_PREFIX + "ollama_model", m);
  }
  setPaused(v: boolean) {
    this.paused = v;
    lsSaveNow(ER_PREFIX + "paused", v);
  }

  // ── Settings (panel-level, structured) ─────────────────────────────────────
  // Operator preferences, not identity. Kept separate from soul/instructions/
  // skills because those describe who Erebus is, not how the panel behaves.
  // Replaces the deleted utils/storage.ts.

  saveSettings(settings: unknown): void {
    this.settings = settings;
    lsSaveNow(ER_PREFIX + "settings", settings);
  }

  getSettings<T>(fallback: T): T {
    if (this.settings) return this.settings as T;
    const stored = lsLoad<T>(ER_PREFIX + "settings", fallback);
    this.settings = stored;
    return stored;
  }

  log(action: string, detail = "") {
    this.actionLog.unshift({
      action,
      detail: detail || "",
      time: new Date().toISOString(),
    });
    if (this.actionLog.length > 100) this.actionLog.pop();
    lsSaveDebounced(ER_PREFIX + "log", this.actionLog);
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  addProject(title: string, description = "") {
    const p = {
      id: Date.now(),
      title,
      description,
      tasks: [] as Array<{ id: number; text: string; done: boolean }>,
      status: "active",
      created: new Date().toISOString(),
    };
    this.projects.push(p);
    lsSaveNow(ER_PREFIX + "proj", this.projects);
    return p;
  }

  updateProject(id: number, updates: Record<string, unknown>) {
    this.projects = this.projects.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    lsSaveNow(ER_PREFIX + "proj", this.projects);
  }

  deleteProject(id: number) {
    this.projects = this.projects.filter((p) => p.id !== id);
    lsSaveNow(ER_PREFIX + "proj", this.projects);
  }

  addProjectTask(projectId: number, task: string) {
    this.projects = this.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            tasks: [...p.tasks, { id: Date.now(), text: task, done: false }],
          }
        : p,
    );
    lsSaveNow(ER_PREFIX + "proj", this.projects);
  }

  toggleProjectTask(projectId: number, taskId: number) {
    this.projects = this.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            tasks: p.tasks.map((t: { id: number; done: any; }) =>
              t.id === taskId ? { ...t, done: !t.done } : t,
            ),
          }
        : p,
    );
    lsSaveNow(ER_PREFIX + "proj", this.projects);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  // Leaves runtime state (wakeState, online flags) alone so callers holding
  // a reference to `core` don't suddenly see the world flip to offline.

  resetToDefaults() {
    [
      "short",
      "lt",
      "goals",
      "leads",
      "soul",
      "instr",
      "skills",
      "log",
      "proj",
      "paused",
      "model",
      "ollama_model",
      "settings",
    ].forEach((k) => localStorage.removeItem(ER_PREFIX + k));

    this.shortTerm = [];
    this.longTerm = { facts: {}, reflections: [], tasks: [] };
    this.goals = [];
    this.leads = [];
    this.soul = this._defaultSoul();
    this.instructions = this._defaultInstructions();
    this.skills = this._defaultSkills();
    this.actionLog = [];
    this.projects = [];
    this.paused = false;
    this.model = "auto";
    this.ollamaModel = "llama3.2";
    this.settings = null;
    this._invalidateSystemPrompt();
  }

  // Back-compat alias — old code called factoryReset().
  factoryReset() {
    this.resetToDefaults();
  }
}

let _core: ErebusCore | null = null;
export function getErebusCore(): ErebusCore {
  if (!_core) _core = new ErebusCore();
  return _core;
}
export { WORKER, BACKEND, BROWSER_AGENT, OLLAMA };
export default ErebusCore;