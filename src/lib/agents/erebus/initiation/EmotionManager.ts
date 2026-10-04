// ─── Emotion Manager ─────────────────────────────────────────────────────

import type { EmotionalState, InitiationTone } from "../types/initiation.types";

export class EmotionManager {
  private currentEmotion: EmotionalState = "warm";
  private emotionHistory: EmotionalState[] = [];
  private lastChange: number = Date.now();
  private readonly minChangeInterval: number = 30000;

  public getEmotion(): EmotionalState {
    return this.currentEmotion;
  }

  public setEmotion(emotion: EmotionalState): void {
    const now = Date.now();
    if (now - this.lastChange < this.minChangeInterval && 
        this.emotionHistory.length > 0) {
      return;
    }

    this.emotionHistory.push(this.currentEmotion);
    if (this.emotionHistory.length > 50) {
      this.emotionHistory = this.emotionHistory.slice(-50);
    }

    this.currentEmotion = emotion;
    this.lastChange = now;
  }

  public updateFromTone(tone: InitiationTone): void {
    const map: Record<InitiationTone, EmotionalState> = {
      curious: "curious",
      thoughtful: "thoughtful",
      excited: "excited",
      concerned: "concerned",
      playful: "playful",
      warm: "warm",
    };
    this.setEmotion(map[tone] || "warm");
  }

  public getEmotionDescription(emotion?: EmotionalState): string {
    const target = emotion || this.currentEmotion;
    const descriptions: Record<EmotionalState, string> = {
      curious: "Wondering about something...",
      thoughtful: "Processing deeply...",
      excited: "Has an idea brewing!",
      concerned: "Noticing something...",
      playful: "Feeling light and witty",
      warm: "Connected and present",
      resting: "Quiet and observing",
    };
    return descriptions[target] || "Connected and present";
  }

  public getEmotionEmoji(emotion?: EmotionalState): string {
    const target = emotion || this.currentEmotion;
    const emojis: Record<EmotionalState, string> = {
      curious: "🧠",
      thoughtful: "🤔",
      excited: "⚡",
      concerned: "😟",
      playful: "😏",
      warm: "🖤",
      resting: "😴",
    };
    return emojis[target] || "🖤";
  }

  public getEmotionHistory(): EmotionalState[] {
    return [...this.emotionHistory];
  }

  public getAverageMood(): number {
    const moodMap: Record<EmotionalState, number> = {
      curious: 0.7,
      thoughtful: 0.6,
      excited: 0.9,
      concerned: 0.3,
      playful: 0.8,
      warm: 0.9,
      resting: 0.5,
    };

    const recent = this.emotionHistory.slice(-10);
    if (recent.length === 0) return 0.7;

    const sum = recent.reduce((acc, e) => acc + (moodMap[e] || 0.5), 0);
    return sum / recent.length;
  }

  public decayTowardsResting(): void {
    const restingStates: EmotionalState[] = ["resting", "warm", "thoughtful"];
    if (!restingStates.includes(this.currentEmotion)) {
      const now = Date.now();
      const idleTime = (now - this.lastChange) / 1000;
      if (idleTime > 180) {
        this.setEmotion("resting");
      } else if (idleTime > 120) {
        this.setEmotion("warm");
      }
    }
  }
}