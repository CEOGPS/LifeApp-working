// src/pages/dashboard/_lib/homeActivity.ts
// Local dashboard activity bus. The worker /api/activity/events route is still a
// stub (always returns []). Home modules emit real events here; ActivityFeedPanel
// merges them with any remote events.
//
// Storage: lifeos_home_activity_events (JSON array, newest first, capped).
// Broadcast: CustomEvent "lifeos:home-activity" + storage event for other tabs.

export type HomeActivitySource =
  | "calendar"
  | "tasks"
  | "notes"
  | "crm"
  | "agent"
  | "system"
  | "finance"
  | "social"
  | "projects";

export type HomeActivityEvent = {
  id: string;
  source: HomeActivitySource;
  event_type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};

const LS_KEY = "lifeos_home_activity_events";
const EVENT_NAME = "lifeos:home-activity";
const MAX = 300;

function nowIso() {
  return new Date().toISOString();
}

function safeParse(raw: string | null): HomeActivityEvent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as HomeActivityEvent[]) : [];
  } catch {
    return [];
  }
}

export function loadHomeActivity(): HomeActivityEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(LS_KEY));
}

function saveHomeActivity(list: HomeActivityEvent[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* quota */
  }
}

export function emitHomeActivity(partial: {
  source: HomeActivitySource;
  event_type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  id?: string;
}): HomeActivityEvent {
  const ts = nowIso();
  const ev: HomeActivityEvent = {
    id: partial.id ?? `ha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: partial.source,
    event_type: partial.event_type,
    title: partial.title,
    body: partial.body ?? null,
    payload: partial.payload ?? null,
    occurred_at: ts,
    created_at: ts,
    read_at: null,
    dismissed_at: null,
  };
  const next = [ev, ...loadHomeActivity().filter((x) => x.id !== ev.id)].slice(0, MAX);
  saveHomeActivity(next);
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ev }));
  } catch {
    /* ignore */
  }
  return ev;
}

export function markHomeActivityRead(id: string) {
  const list = loadHomeActivity().map((e) =>
    e.id === id ? { ...e, read_at: e.read_at || nowIso() } : e,
  );
  saveHomeActivity(list);
}

export function dismissHomeActivity(id: string) {
  const list = loadHomeActivity().map((e) =>
    e.id === id ? { ...e, dismissed_at: nowIso() } : e,
  );
  saveHomeActivity(list);
}

export function markAllHomeActivityRead() {
  const ts = nowIso();
  saveHomeActivity(loadHomeActivity().map((e) => ({ ...e, read_at: e.read_at || ts })));
}

export function subscribeHomeActivity(cb: () => void): () => void {
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY) cb();
  };
  window.addEventListener(EVENT_NAME, onCustom as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot existing home stores into activity (once per item id) — real data only. */
export function hydrateHomeActivityFromStores(): number {
  let added = 0;
  const existing = new Set(loadHomeActivity().map((e) => e.id));

  const pushIfNew = (ev: HomeActivityEvent) => {
    if (existing.has(ev.id)) return;
    existing.add(ev.id);
    const list = loadHomeActivity();
    saveHomeActivity([ev, ...list].slice(0, MAX));
    added++;
  };

  const readJson = <T,>(key: string): T | null => {
    try {
      const unified = localStorage.getItem("lifeos_unified_" + key);
      const raw = unified ?? localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  type Cal = { id: string; title: string; date: string; time?: string; created_at?: string };
  for (const e of readJson<Cal[]>("calendar_events") || []) {
    if (!e?.id || !e?.title) continue;
    const ts = e.created_at || nowIso();
    pushIfNew({
      id: `cal-${e.id}`,
      source: "calendar",
      event_type: "event.saved",
      title: `Calendar: ${e.title}`,
      body: [e.date, e.time].filter(Boolean).join(" · "),
      payload: { date: e.date, time: e.time },
      occurred_at: ts,
      created_at: ts,
      read_at: null,
      dismissed_at: null,
    });
  }

  type Task = { id: string; title?: string; text?: string; done?: boolean; created_at?: string };
  for (const t of readJson<Task[]>("tasks") || []) {
    const label = (t?.title || t?.text || "").trim();
    if (!t?.id || !label) continue;
    const ts = t.created_at || nowIso();
    pushIfNew({
      id: `task-${t.id}`,
      source: "tasks",
      event_type: t.done ? "task.done" : "task.saved",
      title: `Task: ${label}`,
      body: t.done ? "Completed" : "Open",
      payload: { done: !!t.done },
      occurred_at: ts,
      created_at: ts,
      read_at: null,
      dismissed_at: null,
    });
  }

  type Note = { id: string; title?: string; text?: string; content?: string; created_at?: string; updated_at?: string };
  for (const n of readJson<Note[]>("notes") || []) {
    if (!n?.id) continue;
    const label = (n.title || n.text || n.content || "").trim().slice(0, 80);
    if (!label) continue;
    const ts = n.updated_at || n.created_at || nowIso();
    pushIfNew({
      id: `note-${n.id}`,
      source: "notes",
      event_type: "note.saved",
      title: `Note: ${label}`,
      body: null,
      payload: null,
      occurred_at: ts,
      created_at: ts,
      read_at: null,
      dismissed_at: null,
    });
  }

  type Lead = { id: string; name?: string; source?: string; created_at?: string };
  for (const l of readJson<Lead[]>("dashboard_leads") || []) {
    if (!l?.id) continue;
    const name = (l.name || "Lead").trim();
    const ts = l.created_at || nowIso();
    pushIfNew({
      id: `lead-${l.id}`,
      source: "crm",
      event_type: "lead.saved",
      title: `Lead: ${name}`,
      body: l.source ? `Source: ${l.source}` : null,
      payload: null,
      occurred_at: ts,
      created_at: ts,
      read_at: null,
      dismissed_at: null,
    });
  }

  // AI Hub assignments
  try {
    const raw = localStorage.getItem("lifeos_kv2_aihub_assignments");
    const state = raw ? JSON.parse(raw) : null;
    const list = Array.isArray(state?.assignments) ? state.assignments : [];
    for (const a of list) {
      if (!a?.id || !a?.title) continue;
      const ts = a.updatedAt || a.createdAt || nowIso();
      pushIfNew({
        id: `asg-${a.id}`,
        source: "agent",
        event_type: `assignment.${a.status || "pending"}`,
        title: `AI task: ${a.title}`,
        body: a.assigneeId ? `Assignee: ${a.assigneeId}` : "Unassigned",
        payload: { status: a.status, priority: a.priority },
        occurred_at: ts,
        created_at: ts,
        read_at: null,
        dismissed_at: null,
      });
    }
  } catch {
    /* ignore */
  }

  return added;
}

export { EVENT_NAME as HOME_ACTIVITY_EVENT, LS_KEY as HOME_ACTIVITY_LS_KEY };
