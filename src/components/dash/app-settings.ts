const KEY = "lifeos.app-settings";

export type AppSettings = {
  notifyCalendar: boolean;
  notifyLeads: boolean;
  motion: boolean;
};

const DEFAULTS: AppSettings = { notifyCalendar: true, notifyLeads: true, motion: true };
const listeners = new Set<() => void>();

export function appSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<AppSettings>;
    return {
      notifyCalendar: raw.notifyCalendar !== false,
      notifyLeads: raw.notifyLeads !== false,
      motion: raw.motion !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveAppSettings(next: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
  document.documentElement.dataset.motion = next.motion ? "on" : "off";
  listeners.forEach((fn) => fn());
}

export function onAppSettings(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function applyMotion() {
  document.documentElement.dataset.motion = appSettings().motion ? "on" : "off";
}

export type Notice = { id: string; kind: string; title: string; body: string; at: number; read: boolean };

const NOTICE_KEY = "lifeos.notices";

export function listNotices(): Notice[] {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTICE_KEY) || "[]") as Notice[];
    return Array.isArray(raw) ? raw.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function markNoticesRead() {
  const next = listNotices().map((row) => ({ ...row, read: true }));
  localStorage.setItem(NOTICE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function pushNotice(kind: "calendar" | "leads", title: string, body: string) {
  const prefs = appSettings();
  if (kind === "calendar" && !prefs.notifyCalendar) return;
  if (kind === "leads" && !prefs.notifyLeads) return;
  const row: Notice = { id: crypto.randomUUID(), kind, title, body, at: Date.now(), read: false };
  localStorage.setItem(NOTICE_KEY, JSON.stringify([row, ...listNotices()].slice(0, 40)));
  listeners.forEach((fn) => fn());
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
