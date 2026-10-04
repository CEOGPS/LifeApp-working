// ─── Personality Filter ──────────────────────────────────────────────────

import type { Personality } from "../types/initiation.types";

export class PersonalityFilter {
  private personality: Personality;

  constructor(personality: Personality) {
    this.personality = personality;
  }

  public updatePersonality(personality: Personality): void {
    this.personality = personality;
  }

  public filter(text: string): string {
    let result = text;

    if (this.personality.empathy > 7) {
      result = this.addWarmth(result);
    }

    if (this.personality.playfulness > 7) {
      result = this.addPlayfulness(result);
    }

    if (this.personality.directness > 7) {
      result = this.shorten(result);
    }

    if (this.personality.expressiveness > 7) {
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

  public determineTone(triggerSource: string): "curious" | "thoughtful" | "excited" | "concerned" | "playful" | "warm" {
    const weights: Record<string, number> = {
      curious: 0.2 + (this.personality.expressiveness / 20),
      thoughtful: 0.2 + (1 - this.personality.playfulness / 10) * 0.3,
      excited: 0.1 + (this.personality.playfulness / 20),
      concerned: 0.1 + (this.personality.empathy / 20),
      playful: 0.1 + (this.personality.playfulness / 15),
      warm: 0.1 + (this.personality.empathy / 15),
    };

    if (triggerSource === "morning") weights.warm += 0.2;
    if (triggerSource === "evening") weights.warm += 0.2;
    if (triggerSource === "curiosity") weights.curious += 0.3;
    if (triggerSource === "inactivity") weights.concerned += 0.2;

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [tone, weight] of Object.entries(weights)) {
      rand -= weight;
      if (rand <= 0) return tone as any;
    }

    return "warm";
  }

  public mapToneToExpression(
    tone: string
  ): "idle" | "talk" | "smile" | "thinking" | "concerned" {
    const map: Record<string, any> = {
      curious: "thinking",
      thoughtful: "thinking",
      excited: "smile",
      concerned: "concerned",
      playful: "smile",
      warm: "smile",
    };
    return map[tone] || "idle";
  }
}