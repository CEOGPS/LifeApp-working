// src/lib/agents/erebus/dock/dockStore.ts
// Shared state for the Erebus dock, center stage, floating window and PiP.
// Settings persist to Supabase (public.app_settings "erebus_dock_settings",
// owner-scoped) with localStorage only as a cache; the quick-chat history
// persists as "erebus_dock_chat" (last 60 messages).
import { create } from "zustand";
import { unifiedGet, unifiedSet } from "@/lib/unifiedStorage";
import { OWNER_CHANGED_EVENT } from "@/lib/owner";
import { stackChat, type ChatMsg } from "./erebusStack";

export type Placement = "stage" | "dock" | "float";
export type DockMode = "chat" | "writer" | "image" | "sound" | "video";
// PATCH (home-page2): "home" = the tall Erebus window in the centre column of the home page.
export type TargetName = "dock" | "stage" | "float" | "pip" | "home";

export interface DockSettings {
  skin: string;
  voice: string;
  speed: number;
  volume: number;
  muted: boolean;
  autoSpeak: boolean;
  voiceInput: boolean;
  autoOpen: boolean;
  proactive: boolean;
  placement: Placement;
  mode: DockMode;
  floatPos: { x: number; y: number };
  /** PATCH (home-page2): true once the user picked a skin; until then the default (cyan hologram) applies. */
  skinChosen?: boolean;
}

export const DEFAULT_DOCK_SETTINGS: DockSettings = {
  skin: "nova",
  voice: "af_heart",
  speed: 1,
  volume: 0.9,
  muted: false,
  autoSpeak: true,
  voiceInput: true,
  autoOpen: false,
  proactive: true,
  placement: "float",
  mode: "chat",
  floatPos: { x: 24, y: 120 },
};

export interface DockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  via?: string;
  error?: boolean;
}

export type AvatarActivity = "idle" | "thinking" | "speaking" | "listening";

interface DockState {
  settings: DockSettings;
  settingsLoaded: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  dockOpen: boolean;
  activity: AvatarActivity;
  messages: DockMessage[];
  sending: boolean;
  pipWindow: Window | null;
  targets: Partial<Record<TargetName, HTMLElement | null>>;
  activeTarget: TargetName | null;
  // bridges registered by AvatarHost
  sayFn: ((text: string) => Promise<void>) | null;
  stopFn: (() => void) | null;
  detachFn: (() => Promise<void>) | null;

  update: (patch: Partial<DockSettings>) => void;
  setDockOpen: (v: boolean) => void;
  setActivity: (a: AvatarActivity) => void;
  setTarget: (name: TargetName, el: HTMLElement | null) => void;
  setPipWindow: (w: Window | null) => void;
  setActiveTarget: (t: TargetName | null) => void;
  registerBridges: (b: Partial<Pick<DockState, "sayFn" | "stopFn" | "detachFn">>) => void;
  sendChat: (text: string) => Promise<DockMessage | null>;
  clearChat: () => void;
  say: (text: string) => Promise<void>;
}

const SETTINGS_KEY = "erebus_dock_settings";
const CHAT_KEY = "erebus_dock_chat";

export const EREBUS_SYSTEM_PROMPT =
  "You are Erebus, Chris's AI companion inside LifeOS / CEO GPS. Be direct, concise and actionable. " +
  "Address Chris by name when natural. Never claim to be another AI. Do not invent data you do not have; say when you are unsure.";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
// True once the user changed a setting; a late hydrate must not overwrite it.
let touched = false;
let chatTimer: ReturnType<typeof setTimeout> | null = null;

export const useDockStore = create<DockState>((set, get) => ({
  settings: DEFAULT_DOCK_SETTINGS,
  settingsLoaded: false,
  saveState: "idle",
  dockOpen: false,
  activity: "idle",
  messages: [],
  sending: false,
  pipWindow: null,
  targets: {},
  activeTarget: null,
  sayFn: null,
  stopFn: null,
  detachFn: null,

  update: (patch) => {
    touched = true;
    const settings = { ...get().settings, ...patch };
    set({ settings, saveState: "saving" });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const ok = await unifiedSet(SETTINGS_KEY, settings).catch(() => false);
      set({ saveState: ok ? "saved" : "error" });
    }, 600);
  },
  setDockOpen: (v) => set({ dockOpen: v }),
  setActivity: (a) => set({ activity: a }),
  setTarget: (name, el) => {
    if (get().targets[name] === el) return;
    set({ targets: { ...get().targets, [name]: el } });
  },
  setPipWindow: (w) => set({ pipWindow: w }),
  setActiveTarget: (t) => get().activeTarget !== t && set({ activeTarget: t }),
  registerBridges: (b) => set(b as Partial<DockState>),

  say: async (text) => {
    const fn = get().sayFn;
    if (fn && !get().settings.muted) await fn(text);
  },

  clearChat: () => {
    set({ messages: [] });
    void unifiedSet(CHAT_KEY, []);
  },

  sendChat: async (text) => {
    const clean = text.trim();
    if (!clean || get().sending) return null;
    const userMsg: DockMessage = { id: `${Date.now()}u`, role: "user", content: clean, timestamp: Date.now() };
    set({ messages: [...get().messages, userMsg], sending: true, activity: "thinking" });
    const history: ChatMsg[] = get()
      .messages.filter((m) => !m.error)
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await stackChat(EREBUS_SYSTEM_PROMPT, history);
    const reply: DockMessage = res.ok
      ? { id: `${Date.now()}a`, role: "assistant", content: res.text, timestamp: Date.now(), via: res.via }
      : {
          id: `${Date.now()}a`,
          role: "assistant",
          content: `I couldn't reach any backend in your stack.\n${res.error}`,
          timestamp: Date.now(),
          error: true,
        };
    set({ messages: [...get().messages, reply], sending: false, activity: "idle" });
    persistChat();
    const s = get().settings;
    if (s.autoOpen && !get().dockOpen) set({ dockOpen: true });
    if (res.ok && s.autoSpeak && !s.muted) void get().say(res.text.slice(0, 700));
    return reply;
  },
}));

function persistChat() {
  if (chatTimer) clearTimeout(chatTimer);
  chatTimer = setTimeout(() => {
    void unifiedSet(CHAT_KEY, useDockStore.getState().messages.slice(-60));
  }, 800);
}

// PATCH (home-page2): settings saved before the hologram default carry the old default
// skin ("portrait") without an explicit choice; show the new default for those.
function withDefaultSkin(s: DockSettings): DockSettings {
  const skin = s.skin === "nova" || s.skin === "ember" || s.skin === "nyx" ? s.skin : "nova";
  const placement = s.placement === "stage" ? "float" : s.placement;
  return { ...s, skin, placement };
}

// Initial hydrate (remote first) + re-hydrate when the owner link changes.
async function hydrate() {
  try {
    const [s, chat] = await Promise.all([
      unifiedGet<Partial<DockSettings>>(SETTINGS_KEY, { preferRemote: true }),
      unifiedGet<DockMessage[]>(CHAT_KEY, { preferRemote: true }),
    ]);
    useDockStore.setState((st) => ({
      // Remote wins unless the user already changed something this session.
      settings: touched ? st.settings : withDefaultSkin({ ...DEFAULT_DOCK_SETTINGS, ...(s || {}) }),
      settingsLoaded: true,
      messages: st.messages.length ? st.messages : Array.isArray(chat) ? chat : [],
    }));
    if (touched) void unifiedSet(SETTINGS_KEY, useDockStore.getState().settings);
  } catch {
    useDockStore.setState({ settingsLoaded: true });
  }
}
if (typeof window !== "undefined") {
  void hydrate();
  window.addEventListener(OWNER_CHANGED_EVENT, () => {
    touched = false;
    void hydrate();
  });
}
