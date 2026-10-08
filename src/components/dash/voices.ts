export const VOICES = [
  { name: "uTZG", id: "uTZG99vYUBiDowASgVNz" },
  { name: "Lily", id: "pFZP5JQG7iQjIQuC4Bku" },
  { name: "Jessica", id: "cgSgspJ2msm6clMCkdW9" },
  { name: "Matilda", id: "XrExE9yKIg1WjnnlVkGX" },
  { name: "Alice", id: "Xb7hH8MSUJpSbSDYk0k2" },
  { name: "Laura", id: "FGY2WhTYpPnrIDTdsKH5" },
  { name: "Sarah", id: "EXAVITQu4vr4xnSDxMaL" },
  { name: "5z1d", id: "5z1dCJ9XLHwLPLqjq7Dz" },
  { name: "Stephanie", id: "09vslFmztgVtc8A1kDJl" },
  { name: "Jedediah", id: "Cb8NLd0sUB8jI4MW2f9M" },
  { name: "Selected", id: "nscgRrDRVT6a2RCQs92V" },
] as const;

const ASSIGNED: Record<string, string> = {
  Erebus: "EXAVITQu4vr4xnSDxMaL",
  Kranos: "pFZP5JQG7iQjIQuC4Bku",
  Zero: "cgSgspJ2msm6clMCkdW9",
  Inferno: "XrExE9yKIg1WjnnlVkGX",
  Nova: "Xb7hH8MSUJpSbSDYk0k2",
  Viper: "FGY2WhTYpPnrIDTdsKH5",
  Rage: "EXAVITQu4vr4xnSDxMaL",
  Aurora: "5z1dCJ9XLHwLPLqjq7Dz",
  Breeze: "09vslFmztgVtc8A1kDJl",
  Wire: "uTZG99vYUBiDowASgVNz",
  Clerk: "pFZP5JQG7iQjIQuC4Bku",
  Closer: "cgSgspJ2msm6clMCkdW9",
  Signal: "XrExE9yKIg1WjnnlVkGX",
  Pulse: "Xb7hH8MSUJpSbSDYk0k2",
  Line: "FGY2WhTYpPnrIDTdsKH5",
  Studio: "EXAVITQu4vr4xnSDxMaL",
  Host: "5z1dCJ9XLHwLPLqjq7Dz",
  Scout: "09vslFmztgVtc8A1kDJl",
  Gauge: "Cb8NLd0sUB8jI4MW2f9M",
  Hack: "uTZG99vYUBiDowASgVNz",
  Lens: "pFZP5JQG7iQjIQuC4Bku",
  Sim: "cgSgspJ2msm6clMCkdW9",
  Lead: "XrExE9yKIg1WjnnlVkGX",
  Book: "Xb7hH8MSUJpSbSDYk0k2",
  Telegram: "FGY2WhTYpPnrIDTdsKH5",
  Hermes: "EXAVITQu4vr4xnSDxMaL",
  Qwen: "5z1dCJ9XLHwLPLqjq7Dz",
};

export function voiceId(value: string) {
  const hit = VOICES.find((voice) => voice.id === value || voice.name === value);
  return hit?.id || ASSIGNED[value] || VOICES[0].id;
}

export function voiceName(value: string) {
  const id = voiceId(value);
  return VOICES.find((voice) => voice.id === id)?.name || "Voice";
}

export function defaultVoice(agent: string) {
  return ASSIGNED[agent] || VOICES[0].id;
}

export function readClones(notes: { title: string; body: string }[]) {
  try {
    const parsed = JSON.parse(notes.find((row) => row.title === "Voice · Clones")?.body || "[]") as { name?: string; id?: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row?.id && row?.name).map((row) => ({ name: String(row.name).slice(0, 40), id: String(row.id).slice(0, 80) }));
  } catch {
    return [];
  }
}
