// ─── Initiation Engine Types ──────────────────────────────────────────────

export type PresenceState = 
  | "LISTENING" 
  | "THINKING" 
  | "ABOUT_TO_SPEAK" 
  | "SPEAKING" 
  | "RESTING";

export type EmotionalState = 
  | "curious" 
  | "thoughtful" 
  | "excited" 
  | "concerned" 
  | "playful" 
  | "warm" 
  | "resting";

export type InitiationTone = 
  | "curious" 
  | "thoughtful" 
  | "excited" 
  | "concerned" 
  | "playful" 
  | "warm";

export type TriggerType = 
  | "time_morning" 
  | "time_evening" 
  | "calendar" 
  | "tasks" 
  | "crm" 
  | "inactivity" 
  | "curiosity" 
  | "context";

export interface Personality {
  talkativeness: number;    // 0-10
  expressiveness: number;   // 0-10
  playfulness: number;      // 0-10
  directness: number;       // 0-10
  empathy: number;          // 0-10
}

export interface TriggerSettings {
  time_morning: boolean;
  time_evening: boolean;
  calendar: boolean;
  tasks: boolean;
  crm: boolean;
  inactivity: boolean;
  curiosity: boolean;
  context: boolean;
}

export interface CooldownSettings {
  minInterval: number; // seconds between initiations
  lastSpoke: number | null; // timestamp
}

export interface InitiationMessage {
  id?: string;
  text: string;
  tone: InitiationTone;
  expression: "idle" | "talk" | "smile" | "thinking" | "concerned";
  urgency: number; // 0-1
  priority: "low" | "medium" | "high";
  trigger: TriggerType | string;
  timestamp?: number;
}

export interface InitiationLogEntry {
  id: string;
  text: string;
  timestamp: number;
  tone: InitiationTone;
  trigger: TriggerType | string;
}

export interface TriggerResult {
  type: TriggerType | string;
  source: string;
  relevance: number;
  data: any;
  description: string;
  generate: () => string;
}

export interface InitiationState {
  presence: PresenceState;
  emotionalState: EmotionalState;
  lastInitiation: InitiationLogEntry | null;
  log: InitiationLogEntry[];
  isDND: boolean;
  personality: Personality;
  triggers: TriggerSettings;
  cooldown: CooldownSettings;
}

export interface InitiationEngineEvents {
  onInitiation?: (message: InitiationMessage) => void;
  onStateChange?: (state: InitiationState) => void;
  onEmotionChange?: (emotion: EmotionalState) => void;
  onPresenceChange?: (presence: PresenceState) => void;
}

export const DEFAULT_PERSONALITY: Personality = {
  talkativeness: 6,
  expressiveness: 7,
  playfulness: 5,
  directness: 6,
  empathy: 8,
};

export const DEFAULT_TRIGGERS: TriggerSettings = {
  time_morning: true,
  time_evening: true,
  calendar: true,
  tasks: true,
  crm: true,
  inactivity: true,
  curiosity: true,
  context: false,
};

export const DEFAULT_COOLDOWN: CooldownSettings = {
  minInterval: 120,
  lastSpoke: null,
};

export const PRESENCE_COLORS: Record<PresenceState, string> = {
  LISTENING: "#00c896",
  THINKING: "#4ab3f4",
  ABOUT_TO_SPEAK: "#ff8c42",
  SPEAKING: "#8b7fff",
  RESTING: "#50505a",
};

export const EMOTION_EMOJIS: Record<EmotionalState, string> = {
  curious: "🧠",
  thoughtful: "🤔",
  excited: "⚡",
  concerned: "😟",
  playful: "😏",
  warm: "🖤",
  resting: "😴",
};

export const EMOTION_DESCRIPTIONS: Record<EmotionalState, string> = {
  curious: "Wondering about something...",
  thoughtful: "Processing deeply...",
  excited: "Has an idea brewing!",
  concerned: "Noticing something...",
  playful: "Feeling light and witty",
  warm: "Connected and present",
  resting: "Quiet and observing",
};