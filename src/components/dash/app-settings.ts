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

export function pushNotice(kind: "calendar" | "leads", title: string, body: string) {
  const prefs = appSettings();
  if (kind === "calendar" && !prefs.notifyCalendar) return;
  if (kind === "leads" && !prefs.notifyLeads) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(title, { body });
}
