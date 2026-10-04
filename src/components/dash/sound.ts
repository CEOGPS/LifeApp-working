const KEY = "lifeos.sound";

export type SoundPrefs = { muted: boolean; volume: number };

const listeners = new Set<() => void>();

export function soundPrefs(): SoundPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<SoundPrefs>;
    const volume = Number(raw.volume);
    return { muted: Boolean(raw.muted), volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.7 };
  } catch {
    return { muted: false, volume: 0.7 };
  }
}

function write(next: SoundPrefs) {
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function onSoundChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setMuted(muted: boolean) {
  write({ ...soundPrefs(), muted });
}

export function setVolume(volume: number) {
  write({ ...soundPrefs(), volume });
}

let ctx: AudioContext | null = null;

export function playTone(kind: "tap" | "save") {
  const prefs = soundPrefs();
  if (prefs.muted || prefs.volume <= 0 || typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = kind === "save" ? 494 : 880;
  gain.gain.value = prefs.volume * (kind === "save" ? 0.045 : 0.028);
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.start(now);
  osc.stop(now + 0.1);
}
