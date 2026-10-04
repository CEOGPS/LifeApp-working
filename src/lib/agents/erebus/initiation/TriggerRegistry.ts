// ─── Trigger Registry ─────────────────────────────────────────────────────

import type { TriggerResult, TriggerType, TriggerSettings } from "../types/initiation.types";

export class TriggerRegistry {
  private userActivity: { lastActive: number; isIdle: boolean } = {
    lastActive: Date.now(),
    isIdle: false,
  };

  public recordActivity(): void {
    this.userActivity.lastActive = Date.now();
    this.userActivity.isIdle = false;
  }

  private isUserInactive(threshold: number = 300): boolean {
    const elapsed = (Date.now() - this.userActivity.lastActive) / 1000;
    return elapsed > threshold;
  }

  public getMorningTriggers(triggers: TriggerSettings): TriggerResult[] {
    const results: TriggerResult[] = [];
    const hour = new Date().getHours();

    if (triggers.time_morning && hour >= 6 && hour <= 9) {
      const messages = [
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
        generate: () => messages[Math.floor(Math.random() * messages.length)],
      });
    }

    return results;
  }

  public getEveningTriggers(triggers: TriggerSettings): TriggerResult[] {
    const results: TriggerResult[] = [];
    const hour = new Date().getHours();

    if (triggers.time_evening && hour >= 19 && hour <= 22) {
      const messages = [
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
        generate: () => messages[Math.floor(Math.random() * messages.length)],
      });
    }

    return results;
  }

  public getCuriosityTriggers(
    triggers: TriggerSettings,
    talkativeness: number
  ): TriggerResult[] {
    const results: TriggerResult[] = [];

    if (triggers.curiosity) {
      const talkativenessFactor = talkativeness / 20;
      if (Math.random() < talkativenessFactor) {
        const messages = [
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
          relevance: 0.5 + (talkativeness / 40),
          data: {},
          description: "Erebus is curious",
          generate: () => messages[Math.floor(Math.random() * messages.length)],
        });
      }
    }

    return results;
  }

  public getInactivityTriggers(triggers: TriggerSettings): TriggerResult[] {
    const results: TriggerResult[] = [];

    if (triggers.inactivity && this.isUserInactive(300)) {
      const messages = [
        "You've been quiet for a while. Everything okay? I'm here if you need to think out loud.",
        "Still there? I'm around if you want to talk through anything.",
        "I notice you've been away. Let me know when you're back — I have some thoughts.",
      ];
      results.push({
        type: "inactivity",
        source: "inactivity",
        relevance: 0.6,
        data: { idleTime: (Date.now() - this.userActivity.lastActive) / 1000 },
        description: "User inactivity check-in",
        generate: () => messages[Math.floor(Math.random() * messages.length)],
      });
    }

    return results;
  }

  public getAllTriggers(
    triggers: TriggerSettings,
    talkativeness: number
  ): TriggerResult[] {
    const results: TriggerResult[] = [];

    results.push(...this.getMorningTriggers(triggers));
    results.push(...this.getEveningTriggers(triggers));
    results.push(...this.getCuriosityTriggers(triggers, talkativeness));
    results.push(...this.getInactivityTriggers(triggers));

    return results;
  }

  public generateManualTrigger(): TriggerResult {
    const messages = [
      "I was just thinking about something. Want to hear it?",
      "A thought popped into my head. Random, but here it is.",
      "I've been quiet, but I have a question.",
      "Not sure if this matters, but I noticed something.",
      "I've been meaning to ask you something.",
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
}