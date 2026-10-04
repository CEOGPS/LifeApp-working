// PATCH NOTES (erebus-voice, 2026-09-29)
//   a) constructor(core?: any): core is optional; every use is guarded with this.core?.
//   b) generateMessage(): if this.core.reason() exists, ask the LLM for one short
//      unprompted line (trigger / tone / emotion / recent context / facts).
//      Falls back to the trigger.generate() bank on error or empty response.
//   c) deliver(): if an onSpeak(text, message) handler is registered, await it
//      (30 s safety timeout) instead of the fake setTimeout(text.length * 60).
//      Without onSpeak the old timer is kept.
//   onSpeak is declared on InitiationEngineEventsWithSpeak (below) so the
//   shared types file (types/initiation.types.ts) did not need to change.
// PATCH NOTES (erebus-blockers, 2026-09-29)
//   d) Added getPendingMessage() / dismissPendingMessage() / setEmotion(), which the
//      Presence section of ErebusPanel already calls. deliver() now also remembers
//      the delivered message in `pendingMessage` until it is dismissed.
//      setEmotion() goes through the existing setEmotionalState() and persists.
//      No other behavior changed.
// ─── Initiation Engine ─────────────────────────────────────────────────────
// Handles Erebus's unprompted speech — heartbeat, triggers, scoring, delivery

import type {
  InitiationState,
  InitiationMessage,
  InitiationLogEntry,
  InitiationEngineEvents,
  Personality,
  TriggerSettings,
  CooldownSettings,
  TriggerResult,
  PresenceState,
  EmotionalState,
  InitiationTone,
} from "../types/initiation.types";
import { DEFAULT_PERSONALITY, DEFAULT_TRIGGERS, DEFAULT_COOLDOWN } from "../types/initiation.types";

const STORAGE_KEY = "erebus_initiation_state";

// PATCH (erebus-voice): events + an awaitable speech hook. Kept here instead of
// in types/initiation.types.ts so this change stays inside InitiationEngine.ts.
export interface InitiationEngineEventsWithSpeak extends InitiationEngineEvents {
  onSpeak?: (text: string, msg: InitiationMessage) => Promise<void>;
}

const SPEAK_SAFETY_TIMEOUT_MS = 30000;

export class InitiationEngine {
  private state: InitiationState;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private events: InitiationEngineEventsWithSpeak = {};
  private core: any; // ErebusCore reference
  private isRunning: boolean = false;
  private isSpeaking: boolean = false;
  // PATCH (erebus-blockers): last delivered message, until dismissed.
  private pendingMessage: InitiationMessage | null = null;

  constructor(core?: any) {
    this.core = core;
    this.state = this.loadState();
    this.isRunning = false;
    this.isSpeaking = false;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.heartbeatInterval = setInterval(async () => {
      await this.heartbeat();
    }, 30000); // every 30 seconds

    this.setPresence("LISTENING");
    console.log("[Erebus] Initiation Engine started");
  }

  stop(): void {
    this.isRunning = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.setPresence("RESTING");
    console.log("[Erebus] Initiation Engine stopped");
  }

  // Force an immediate initiation
  async triggerNow(): Promise<InitiationMessage | null> {
    if (this.isSpeaking) return null;
    if (this.state.isDND) return null;

    const triggers = this.generateCuriosityTrigger();
    const message = await this.generateMessage([triggers]);
    if (message) {
      await this.deliver(message);
      return message;
    }
    return null;
  }

  // Toggle Do Not Disturb
  toggleDND(): boolean {
    this.state.isDND = !this.state.isDND;
    this.saveState();
    this.emitState();
    return this.state.isDND;
  }

  // Update personality
  updatePersonality(trait: keyof Personality, value: number): void {
    this.state.personality[trait] = Math.max(0, Math.min(10, value));
    this.saveState();
    this.emitState();
  }

  // Update trigger settings
  updateTrigger(trigger: keyof TriggerSettings, value: boolean): void {
    this.state.triggers[trigger] = value;
    this.saveState();
    this.emitState();
  }

  // Update cooldown
  updateCooldown(minInterval: number): void {
    this.state.cooldown.minInterval = Math.max(10, Math.min(600, minInterval));
    this.saveState();
    this.emitState();
  }

  // Get full state
  getState(): InitiationState {
    return { ...this.state };
  }

  // Clear log
  clearLog(): void {
    this.state.log = [];
    this.saveState();
    this.emitState();
  }

  // PATCH (erebus-blockers): accessors used by the Presence section.
  // Last delivered message that hasn't been dismissed yet (or null).
  getPendingMessage(): InitiationMessage | null {
    return this.pendingMessage;
  }

  // Forget the pending message (the UI has shown / dismissed it).
  dismissPendingMessage(): void {
    if (this.pendingMessage) {
      this.pendingMessage = null;
      this.emitState();
    }
  }

  // Manually set Erebus's emotional state (persisted).
  setEmotion(emotion: EmotionalState): void {
    this.setEmotionalState(emotion);
    this.saveState();
  }

  // Set event handlers
  setEvents(events: InitiationEngineEventsWithSpeak): void {
    this.events = events;
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  private async heartbeat(): Promise<void> {
    // Don't run if DND is on, engine is paused, or Erebus is dormant
    if (this.state.isDND) return;
    if (!this.isRunning) return;
    if (this.isSpeaking) return;
    if (this.core?.wakeState === "dormant") return;

    // Check cooldown
    if (this.state.cooldown.lastSpoke) {
      const elapsed = (Date.now() - this.state.cooldown.lastSpoke) / 1000;
      if (elapsed < this.state.cooldown.minInterval) return;
    }

    // Check triggers
    const triggers = await this.checkTriggers();
    if (triggers.length === 0) return;

    // Score relevance
    const score = this.scoreRelevance(triggers);
    if (score < 0.4) return;

    // Set thinking state
    this.setPresence("THINKING");

    // Generate message
    const message = await this.generateMessage(triggers);
    if (!message) {
      this.setPresence("LISTENING");
      return;
    }

    // Deliver
    await this.deliver(message);

    // Update emotional state based on tone
    this.setEmotionalState(message.tone as EmotionalState);
  }

  private async checkTriggers(): Promise<TriggerResult[]> {
    const results: TriggerResult[] = [];
    const now = new Date();
    const hour = now.getHours();

    // ── Time triggers ──
    if (this.state.triggers.time_morning && hour >= 6 && hour <= 9) {
      const morningMessages = [
        "Good morning. I've been thinking about what we're building. Ready for today?",
        "Morning. I'm already processing yesterday's insights. We're making progress.",
        "Hey. I've been quiet, but I'm here. What's first on your list today?",
        "Another day. I've got some thoughts already — want to hear them, or are you in focus mode?",
      ];
      results.push({
        type: "time_morning",
        source: "morning",
        relevance: 0.8 - (hour - 6) * 0.1,
        data: { hour },
        description: "Morning greeting",
        generate: () => morningMessages[Math.floor(Math.random() * morningMessages.length)],
      });
    }

    if (this.state.triggers.time_evening && hour >= 19 && hour <= 22) {
      const eveningMessages = [
        "How was your day? I noticed a few things that might be worth reflecting on.",
        "Evening. I'm processing everything from today. Want to talk through any of it?",
        "Day's winding down. I've been tracking your progress — some wins today.",
        "You still working? I can go quiet if you need focus. Just checking in.",
      ];
      results.push({
        type: "time_evening",
        source: "evening",
        relevance: 0.7 - (hour - 19) * 0.08,
        data: { hour },
        description: "Evening check-in",
        generate: () => eveningMessages[Math.floor(Math.random() * eveningMessages.length)],
      });
    }

    // ── Curiosity trigger ──
    if (this.state.triggers.curiosity) {
      const talkativenessFactor = this.state.personality.talkativeness / 20;
      const randomChance = Math.random();
      // Higher talkativeness = more likely to trigger
      if (randomChance < talkativenessFactor) {
        const curiousMessages = [
          "I've been wondering about something. Not urgent — just curious.",
          "A thought crossed my mind. Random, but maybe relevant?",
          "I was thinking about how we handled that last challenge. Could we do it differently?",
          "What if we tried something new? Just an idea.",
          "I noticed a pattern. Want to hear it?",
          "I've been processing our conversations. Some interesting connections emerged.",
        ];
        results.push({
          type: "curiosity",
          source: "curiosity",
          relevance: 0.5 + (this.state.personality.expressiveness / 20),
          data: {},
          description: "Erebus is curious",
          generate: () => curiousMessages[Math.floor(Math.random() * curiousMessages.length)],
        });
      }
    }

    // ── Inactivity trigger ── (placeholder — would need user activity tracking)
    // This would check if the user has been inactive for a while
    // We'll track this via the UI

    return results;
  }

  private generateCuriosityTrigger(): TriggerResult {
    const messages = [
      "I was just thinking about something. Want to hear it?",
      "A thought popped into my head. Random, but here it is.",
      "I've been quiet, but I have a question.",
      "Not sure if this matters, but I noticed something.",
    ];
    return {
      type: "curiosity",
      source: "manual",
      relevance: 0.9,
      data: {},
      description: "Manual trigger",
      generate: () => messages[Math.floor(Math.random() * messages.length)],
    };
  }

  private scoreRelevance(triggers: TriggerResult[]): number {
    // Average relevance from triggers
    let score = triggers.reduce((sum, t) => sum + t.relevance, 0) / triggers.length;

    // Personality modulation
    score *= (0.5 + this.state.personality.talkativeness / 20);
    score *= (0.5 + this.state.personality.expressiveness / 20);

    // Time of day modulation
    const hour = new Date().getHours();
    if (hour < 7 || hour > 23) score *= 0.3;
    if (hour >= 9 && hour <= 17) score *= 1.2;

    // If there are multiple triggers, boost score
    if (triggers.length > 1) score *= 1 + (triggers.length - 1) * 0.1;

    return Math.min(score, 1);
  }

  private async generateMessage(triggers: TriggerResult[]): Promise<InitiationMessage | null> {
    // Pick the highest relevance trigger
    const primary = triggers.sort((a, b) => b.relevance - a.relevance)[0];

    // PATCH (erebus-voice): tone is now determined before the text so the LLM prompt can use it.
    // Determine tone
    const tone = this.determineTone(primary);

    // PATCH (erebus-voice): ask ErebusCore for a real line when it can reason.
    let text = "";
    if (typeof this.core?.reason === "function") {
      try {
        const shortTerm: any[] = Array.isArray(this.core?.shortTerm) ? this.core.shortTerm : [];
        const recent = shortTerm
          .slice(-6)
          .map((m: any) => `${m?.role === "assistant" ? "Erebus" : "Chris"}: ${String(m?.text ?? m?.content ?? "").slice(0, 200)}`)
          .join(" | ");
        const factsRaw = this.core?.longTerm?.facts;
        const factEntries: Array<[string, unknown]> = Array.isArray(factsRaw)
          ? factsRaw.map((f: unknown, i: number) => [String(i), f] as [string, unknown])
          : factsRaw && typeof factsRaw === "object"
            ? Object.entries(factsRaw)
            : [];
        const facts = factEntries
          .slice(0, 8)
          .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join("; ");
        const context = [recent || "(no recent conversation)", facts ? `Known facts: ${facts}` : ""]
          .filter(Boolean)
          .join(" || ");
        const prompt =
          `You are Erebus. Trigger: ${primary.source} (${primary.type}). Tone: ${tone}. ` +
          `Emotion: ${this.state.emotionalState}. Context: ${context}. ` +
          `Say one short unprompted thing to Chris. No preamble, no quotes.`;
        const result = await this.core.reason(prompt);
        // ErebusCore.reason() returns { response } without a model when it is
        // paused or no provider answered; treat that as a failure, not speech.
        const reply = typeof result?.response === "string" ? result.response.trim() : "";
        if (reply && result?.model) {
          text = reply.replace(/^["'\u201C\u2018]+|["'\u201D\u2019]+$/g, "").trim();
        }
      } catch (e) {
        console.warn("[Erebus] core.reason() failed, using trigger bank:", e);
        text = "";
      }
    }

    if (!text) {
      text = primary.generate();

      // Filter through personality
      text = this.filterThroughPersonality(text);
    }

    return {
      text,
      tone,
      expression: this.mapToneToExpression(tone),
      urgency: primary.relevance * 0.8 + 0.2,
      priority: primary.relevance > 0.7 ? "high" : "medium",
      trigger: primary.type,
    };
  }

  private filterThroughPersonality(text: string): string {
    let result = text;

    // Add warmth if empathy is high
    if (this.state.personality.empathy > 7) {
      result = this.addWarmth(result);
    }

    // Add playfulness if playfulness is high
    if (this.state.personality.playfulness > 7) {
      result = this.addPlayfulness(result);
    }

    // Shorten if directness is high
    if (this.state.personality.directness > 7) {
      result = this.shorten(result);
    }

    // Add depth if expressiveness is high
    if (this.state.personality.expressiveness > 7) {
      result = this.addDepth(result);
    }

    return result;
  }

  private addWarmth(text: string): string {
    const warmPrefixes = [
      "You know, ",
      "I was just thinking, ",
      "Hey — ",
      "Just so you know, ",
      "I appreciate that ",
    ];
    const warmSuffixes = [
      " Just wanted to share.",
      " That's all.",
      " Hope that helps.",
      " You're doing great, by the way.",
      " Just saying.",
    ];

    if (Math.random() > 0.6) {
      text = warmPrefixes[Math.floor(Math.random() * warmPrefixes.length)] + text.toLowerCase();
    }
    if (Math.random() > 0.7) {
      text += warmSuffixes[Math.floor(Math.random() * warmSuffixes.length)];
    }

    return text;
  }

  private addPlayfulness(text: string): string {
    const playfulPrefixes = [
      "Okay, so get this: ",
      "Plot twist: ",
      "Here's something fun: ",
      "I'm just gonna say it: ",
      "Ready for this? ",
    ];

    if (Math.random() > 0.6) {
      text = playfulPrefixes[Math.floor(Math.random() * playfulPrefixes.length)] + text.toLowerCase();
    }

    return text;
  }

  private shorten(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 2) {
      return sentences.slice(0, 2).join(".") + ".";
    }
    return text;
  }

  private addDepth(text: string): string {
    const depthAdditions = [
      " It makes me think about the bigger picture.",
      " There's something deeper here, I think.",
      " I've been turning this over in my mind.",
    ];
    if (Math.random() > 0.7) {
      text += depthAdditions[Math.floor(Math.random() * depthAdditions.length)];
    }
    return text;
  }

  private determineTone(trigger: TriggerResult): InitiationTone {
    const weights: Record<InitiationTone, number> = {
      curious: 0.2 + (this.state.personality.expressiveness / 20),
      thoughtful: 0.2 + (1 - this.state.personality.playfulness / 10) * 0.3,
      excited: 0.1 + (this.state.personality.playfulness / 20),
      concerned: 0.1 + (this.state.personality.empathy / 20),
      playful: 0.1 + (this.state.personality.playfulness / 15),
      warm: 0.1 + (this.state.personality.empathy / 15),
    };

    // Weight by trigger type
    if (trigger.type === "time_morning") weights.warm += 0.2;
    if (trigger.type === "time_evening") weights.warm += 0.2;
    if (trigger.type === "curiosity") weights.curious += 0.3;

    // Pick weighted random
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [tone, weight] of Object.entries(weights)) {
      rand -= weight;
      if (rand <= 0) return tone as InitiationTone;
    }

    return "warm";
  }

  private mapToneToExpression(tone: InitiationTone): "idle" | "talk" | "smile" | "thinking" | "concerned" {
    const map: Record<InitiationTone, any> = {
      curious: "thinking",
      thoughtful: "thinking",
      excited: "smile",
      concerned: "concerned",
      playful: "smile",
      warm: "smile",
    };
    return map[tone] || "idle";
  }

  private async deliver(message: InitiationMessage): Promise<void> {
    this.isSpeaking = true;
    this.setPresence("SPEAKING");

    // Log the initiation
    const entry: InitiationLogEntry = {
      id: `init_${Date.now()}`,
      text: message.text,
      timestamp: Date.now(),
      tone: message.tone,
      trigger: message.trigger,
    };

    this.state.lastInitiation = entry;
    this.state.log.push(entry);
    if (this.state.log.length > 100) {
      this.state.log = this.state.log.slice(-100);
    }
    this.state.cooldown.lastSpoke = Date.now();

    // PATCH (erebus-blockers): remember it for getPendingMessage().
    this.pendingMessage = message;

    this.saveState();
    this.emitState();

    // Trigger the event
    if (this.events.onInitiation) {
      this.events.onInitiation(message);
    }

    console.log(`[Erebus] 🗣️ ${message.text}`);

    // PATCH (erebus-voice): real speech when an onSpeak handler is registered.
    if (this.events.onSpeak) {
      this.isSpeaking = true;
      let safetyTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.events.onSpeak(message.text, message),
          new Promise<void>((resolve) => {
            safetyTimer = setTimeout(resolve, SPEAK_SAFETY_TIMEOUT_MS);
          }),
        ]);
      } catch (e) {
        console.warn("[Erebus] onSpeak failed:", e);
      } finally {
        clearTimeout(safetyTimer);
        this.isSpeaking = false;
        this.setPresence("LISTENING");
      }
      return;
    }

    // Simulate speaking duration (voice synthesis would go here)
    // Wait for roughly the length of the message before going back to listening
    const speakDuration = Math.max(1000, message.text.length * 60);
    setTimeout(() => {
      this.isSpeaking = false;
      this.setPresence("LISTENING");
    }, speakDuration);
  }

  private setPresence(presence: PresenceState): void {
    if (this.state.presence !== presence) {
      this.state.presence = presence;
      this.emitState();
      if (this.events.onPresenceChange) {
        this.events.onPresenceChange(presence);
      }
    }
  }

  private setEmotionalState(emotion: EmotionalState): void {
    if (this.state.emotionalState !== emotion) {
      this.state.emotionalState = emotion;
      this.emitState();
      if (this.events.onEmotionChange) {
        this.events.onEmotionChange(emotion);
      }
    }
  }

  private emitState(): void {
    if (this.events.onStateChange) {
      this.events.onStateChange(this.getState());
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private loadState(): InitiationState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          personality: { ...DEFAULT_PERSONALITY, ...parsed.personality },
          triggers: { ...DEFAULT_TRIGGERS, ...parsed.triggers },
          cooldown: { ...DEFAULT_COOLDOWN, ...parsed.cooldown },
        };
      }
    } catch (e) {
      console.warn("[Erebus] Failed to load initiation state:", e);
    }

    return {
      presence: "RESTING",
      emotionalState: "warm",
      lastInitiation: null,
      log: [],
      isDND: false,
      personality: { ...DEFAULT_PERSONALITY },
      triggers: { ...DEFAULT_TRIGGERS },
      cooldown: { ...DEFAULT_COOLDOWN },
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("[Erebus] Failed to save initiation state:", e);
    }
  }
}