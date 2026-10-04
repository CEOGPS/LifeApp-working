import { create } from "zustand";

export const GENRES = [
  "Pop",
  "Rock",
  "EDM",
  "Jazz",
  "Classical",
  "Hip-Hop",
  "R&B",
  "Country",
  "Metal",
  "Funk",
  "Reggae",
  "Ambient",
  "Lo-Fi",
  "Cinematic",
  "K-Pop",
  "Latin",
];

export const MOODS = [
  "Euphoric",
  "Melancholic",
  "Energetic",
  "Dreamy",
  "Dark",
  "Romantic",
  "Aggressive",
  "Chill",
  "Epic",
  "Nostalgic",
];

export const VOICE_TYPES = [
  "Deep Bass",
  "Tenor",
  "Baritone",
  "Vibrato",
  "Falsetto",
  "Raspy",
  "Soprano",
  "Alto",
  "Whisper",
  "Belt",
];

export const DELIVERIES = [
  "Intense",
  "Laid-back",
  "Sprechgesang",
  "Aggressive",
  "Soothing",
  "Spoken Word",
  "Rap-flow",
];

export const KEYS = [
  "C Major",
  "C# Major",
  "D Major",
  "Eb Major",
  "E Major",
  "F Major",
  "F# Major",
  "G Major",
  "Ab Major",
  "A Major",
  "Bb Major",
  "B Major",
  "C Minor",
  "C# Minor",
  "D Minor",
  "Eb Minor",
  "E Minor",
  "F Minor",
  "F# Minor",
  "G Minor",
  "Ab Minor",
  "A Minor",
  "Bb Minor",
  "B Minor",
];

export const useGenerationStore = create((set, get) => ({
  mode: "standard",
  setMode: (mode) => set({ mode }),

  lyrics: "",
  setLyrics: (lyrics) => set({ lyrics }),

  genre: "Pop",
  setGenre: (genre) => set({ genre }),

  genreSecondary: "Classical",
  setGenreSecondary: (g) => set({ genreSecondary: g }),

  genreBlendActive: false,
  setGenreBlendActive: (v) => set({ genreBlendActive: v }),

  genreBlend: 100,
  setGenreBlend: (v) => set({ genreBlend: v }),

  mood: "Energetic",
  setMood: (mood) => set({ mood }),

  delivery: "Intense",
  setDelivery: (delivery) => set({ delivery }),

  gender: "Male",
  setGender: (gender) => set({ gender }),

  voiceTypes: [],
  toggleVoiceType: (vt) => {
    const current = get().voiceTypes;
    if (current.includes(vt)) {
      set({ voiceTypes: current.filter((v) => v !== vt) });
    } else if (current.length < 3) {
      set({ voiceTypes: [...current, vt] });
    }
  },
  voiceBlend: {},
  setVoiceBlend: (vt, value) =>
    set((state) => ({ voiceBlend: { ...state.voiceBlend, [vt]: value } })),

  bpm: 120,
  setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(240, bpm)) }),

  voiceProfileId: null,
  setVoiceProfileId: (id) => set({ voiceProfileId: id }),

  reset: () =>
    set({
      lyrics: "",
      genre: "Pop",
      mood: "Energetic",
      delivery: "Intense",
      gender: "Male",
      voiceTypes: [],
      voiceBlend: {},
      bpm: 120,
      genreBlendActive: false,
      genreBlend: 100,
      voiceProfileId: null,
    }),
}));
