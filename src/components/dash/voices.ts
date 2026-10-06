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
] as const;

const ASSIGNED: Record<string, string> = {
  Erebus: "Cb8NLd0sUB8jI4MW2f9M",
  Kranos: "pFZP5JQG7iQjIQuC4Bku",
  Zero: "cgSgspJ2msm6clMCkdW9",
  Inferno: "XrExE9yKIg1WjnnlVkGX",
  Nova: "Xb7hH8MSUJpSbSDYk0k2",
  Viper: "FGY2WhTYpPnrIDTdsKH5",
  Rage: "EXAVITQu4vr4xnSDxMaL",
  Aurora: "5z1dCJ9XLHwLPLqjq7Dz",
  Breeze: "09vslFmztgVtc8A1kDJl",
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
