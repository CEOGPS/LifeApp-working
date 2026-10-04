// ─── Agent Core Types ──────────────────────────────────────────────────────

export type AgentStatus = "dormant" | "waking" | "active" | "working" | "resting";

export interface AgentSoul {
  name: string;
  identity: string;
  personality: string;
  values: string[];
  voice: string;
  purpose: string;
}

export interface AgentMemory {
  shortTerm: Array<{
    role: "user" | "assistant" | "system";
    text: string;
    timestamp: number;
  }>;
  longTerm: {
    facts: Record<string, any>;
    reflections: string[];
    preferences: Record<string, any>;
  };
  actionLog: Array<{
    action: string;
    detail: string;
    timestamp: number;
  }>;
}

export interface AgentSkill {
  id: string;
  label: string;
  on: boolean;
  description?: string;
}

export interface AgentProject {
  id: string;
  title: string;
  status: "active" | "paused" | "completed";
  tasks: Array<{
    id: string;
    text: string;
    done: boolean;
  }>;
}

export interface AgentGoal {
  id: string | number;
  goal: string;
  category: string;
  status: "active" | "done" | "locked";
}

export interface AgentState {
  wakeState: AgentStatus;
  soul: AgentSoul;
  shortTerm: AgentMemory["shortTerm"];
  longTerm: AgentMemory["longTerm"];
  actionLog: AgentMemory["actionLog"];
  skills: AgentSkill[];
  projects: AgentProject[];
  goals: AgentGoal[];
  model: string;
  paused: boolean;
  backendOnline: boolean;
  ollamaOnline: boolean;
  ollamaModel: string;
  ollamaModels: string[];
}

export interface ErebusCoreEvents {
  onWake?: () => void;
  onSleep?: () => void;
  onInitiation?: (message: any) => void;
  onStateChange?: (state: AgentState) => void;
  onError?: (error: Error) => void;
}

export interface ErebusSettings {
  permissionLevel: "full" | "ask_first" | "read_only" | "off";
  canSendEmail: boolean;
  canMakeCalls: boolean;
  canAccessFiles: boolean;
  canModifySystem: boolean;
  canMakePurchases: boolean;
  canBrowseWeb: boolean;
  allowPolitics: boolean;
  allowFinance: boolean;
  allowMedical: boolean;
  allowLegal: boolean;
  allowAdult: boolean;
  allowPersonal: boolean;
  maxUnpromptedPerHour: number;
  maxActionsPerDay: number;
  requireConfirmation: boolean;
  overrideCode: string;
  emergencyPaused: boolean;
}

export const DEFAULT_SETTINGS: ErebusSettings = {
  permissionLevel: "full",
  canSendEmail: true,
  canMakeCalls: false,
  canAccessFiles: true,
  canModifySystem: false,
  canMakePurchases: false,
  canBrowseWeb: true,
  allowPolitics: false,
  allowFinance: false,
  allowMedical: false,
  allowLegal: false,
  allowAdult: false,
  allowPersonal: true,
  maxUnpromptedPerHour: 3,
  maxActionsPerDay: 20,
  requireConfirmation: true,
  overrideCode: "",
  emergencyPaused: false,
};