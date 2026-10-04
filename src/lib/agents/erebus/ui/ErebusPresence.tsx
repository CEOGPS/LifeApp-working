// ─── Erebus Presence Tab ──────────────────────────────────────────────────
// The UI for controlling Erebus's personality, triggers, and initiation log

import React, { useState } from "react";
import type {
  InitiationState,
  Personality,
  TriggerSettings,
  PresenceState,
  EmotionalState,
  InitiationLogEntry,
  InitiationMessage,
} from "../types/initiation.types";
import { PRESENCE_COLORS, EMOTION_EMOJIS, EMOTION_DESCRIPTIONS } from "../types/initiation.types";

const C = {
  bg: "#07080f",
  bg2: "#0c0d1a",
  card: "#0f1020",
  e: "#9b72cf",
  eHi: "#c4a2f5",
  eDim: "rgba(155,114,207,0.12)",
  teal: "#00c896",
  blue: "#4ab3f4",
  orange: "#ff8c42",
  red: "#ff4f5e",
  green: "#3dd68c",
  text: "#f0ede8",
  t2: "#a0a0b8",
  t3: "#50505a",
};

interface ErebusPresenceProps {
  state: InitiationState;
  onTriggerNow: () => Promise<void>;
  onToggleDND: () => void;
  onUpdatePersonality: (trait: keyof Personality, value: number) => void;
  onUpdateTrigger: (trigger: keyof TriggerSettings, value: boolean) => void;
  onUpdateCooldown: (seconds: number) => void;
  onClearLog: () => void;
  onSetEmotion?: (emotion: EmotionalState) => void;
  isSpeaking?: boolean;
  isThinking?: boolean;
  pendingMessage?: InitiationMessage | null;
}

export function ErebusPresence({
  state,
  onTriggerNow,
  onToggleDND,
  onUpdatePersonality,
  onUpdateTrigger,
  onUpdateCooldown,
  onClearLog,
  onSetEmotion,
  isSpeaking = false,
  isThinking = false,
  pendingMessage = null,
}: ErebusPresenceProps) {
  const [activeSection, setActiveSection] = useState<"status" | "personality" | "triggers" | "log">("status");

  const presence = state.presence;
  const emotion = state.emotionalState;
  const personality = state.personality;
  const triggers = state.triggers;
  const log = state.log;
  const lastInit = state.lastInitiation;
  const isDND = state.isDND;

  const presenceColor = PRESENCE_COLORS[presence] || C.t3;
  const emotionEmoji = EMOTION_EMOJIS[emotion] || "🖤";
  const emotionDesc = EMOTION_DESCRIPTIONS[emotion] || "";

  let displayPresence = presence;
  if (isSpeaking) displayPresence = "SPEAKING";
  else if (isThinking) displayPresence = "THINKING";
  else if (pendingMessage) displayPresence = "ABOUT_TO_SPEAK";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          gap: 3,
          padding: "10px 16px 0",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {["status", "personality", "triggers", "log"].map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s as any)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: activeSection === s ? 700 : 400,
              background: activeSection === s ? C.eDim : "transparent",
              color: activeSection === s ? C.eHi : C.t2,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {activeSection === "status" && (
          <div>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: 12,
                background: C.card,
                border: `1px solid ${presenceColor}44`,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: C.t3,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                  }}
                >
                  Presence
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: presenceColor,
                    marginTop: 4,
                  }}
                >
                  {displayPresence || "RESTING"}
                </div>
                {pendingMessage && (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.t2,
                      marginTop: 4,
                      fontStyle: "italic",
                    }}
                  >
                    "{pendingMessage.text.slice(0, 60)}..."
                  </div>
                )}
              </div>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: presenceColor,
                  animation:
                    displayPresence === "ABOUT_TO_SPEAK" ||
                    displayPresence === "SPEAKING" ||
                    displayPresence === "THINKING"
                      ? "epulse 0.8s infinite"
                      : "none",
                }}
              />
            </div>

            <div
              style={{
                padding: "16px 20px",
                borderRadius: 12,
                background: C.card,
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: C.t3,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Emotional State
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <span style={{ fontSize: 32 }}>{emotionEmoji}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
                    {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                  </div>
                  <div style={{ fontSize: 11, color: C.t2 }}>{emotionDesc}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {(["curious", "thoughtful", "excited", "concerned", "playful", "warm"] as EmotionalState[]).map(
                  (e) => (
                    <button
                      key={e}
                      onClick={() => {
                        if (onSetEmotion) onSetEmotion(e);
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: 10,
                        background: emotion === e ? C.eDim : "rgba(255,255,255,0.04)",
                        border: `1px solid ${emotion === e ? C.e + "44" : "rgba(255,255,255,0.08)"}`,
                        color: emotion === e ? C.eHi : C.t2,
                        cursor: "pointer",
                      }}
                    >
                      {EMOTION_EMOJIS[e]} {e}
                    </button>
                  )
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onTriggerNow}
                disabled={isSpeaking || state.isDND}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  background: isSpeaking || state.isDND ? "rgba(255,255,255,0.05)" : C.eDim,
                  border: `1px solid ${isSpeaking || state.isDND ? "rgba(255,255,255,0.1)" : C.e + "44"}`,
                  color: isSpeaking || state.isDND ? C.t3 : C.eHi,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isSpeaking || state.isDND ? "not-allowed" : "pointer",
                }}
              >
                ⚡ SAY SOMETHING NOW
              </button>
              <button
                onClick={onToggleDND}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  background: isDND ? "rgba(255,79,94,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isDND ? C.red + "44" : "rgba(255,255,255,0.1)"}`,
                  color: isDND ? C.red : C.t2,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isDND ? "🔇 DND ON" : "🔊 DND OFF"}
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t2,
                }}
              >
                <span>Cooldown: {state.cooldown.minInterval}s</span>
                <span>{state.cooldown.lastSpoke ? `${Math.round((Date.now() - state.cooldown.lastSpoke) / 1000)}s ago` : "Ready"}</span>
              </div>
              <input
                type="range"
                min={10}
                max={600}
                step={10}
                value={state.cooldown.minInterval}
                onChange={(e) => onUpdateCooldown(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: C.e,
                  background: C.bg2,
                  height: 4,
                  borderRadius: 2,
                  outline: "none",
                  marginTop: 4,
                }}
              />
            </div>

            {lastInit && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: C.t3,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}
                >
                  Last Initiation
                </div>
                <div style={{ fontSize: 12, color: C.t2, marginTop: 4, fontStyle: "italic" }}>
                  "{lastInit.text}"
                </div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>
                  {lastInit.timestamp ? new Date(lastInit.timestamp).toLocaleString() : "—"} · {lastInit.tone} · {lastInit.trigger}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "personality" && (
          <div>
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 16, lineHeight: 1.6 }}>
              Who Erebus is. These traits affect every interaction — including when and how he speaks unprompted.
            </div>

            {[
              { key: "talkativeness", label: "Talkativeness", min: "Quiet", max: "Chatty", desc: "How often Erebus initiates" },
              { key: "expressiveness", label: "Expressiveness", min: "Reserved", max: "Expressive", desc: "Emotional range and depth" },
              { key: "playfulness", label: "Playfulness", min: "Serious", max: "Witty", desc: "Humor and lightheartedness" },
              { key: "directness", label: "Directness", min: "Diplomatic", max: "Blunt", desc: "How straightforward Erebus is" },
              { key: "empathy", label: "Empathy", min: "Analytical", max: "Compassionate", desc: "Emotional sensitivity" },
            ].map((trait) => (
              <div key={trait.key} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: C.text }}>{trait.label}</span>
                  <span style={{ fontSize: 11, color: C.eHi }}>
                    {personality[trait.key as keyof Personality] || 5}/10
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.t3, marginBottom: 4 }}>
                  {trait.desc}
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={personality[trait.key as keyof Personality] || 5}
                  onChange={(e) => onUpdatePersonality(trait.key as keyof Personality, parseInt(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: C.e,
                    background: C.bg2,
                    height: 4,
                    borderRadius: 2,
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.t3 }}>
                  <span>{trait.min}</span>
                  <span>{trait.max}</span>
                </div>
              </div>
            ))}

            <div
              style={{
                marginTop: 8,
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 11,
                color: C.t3,
                lineHeight: 1.6,
              }}
            >
              💡 These traits combine to form Erebus's unique personality.
              Higher talkativeness = more unprompted messages.
              Higher expressiveness = more emotional range in responses.
            </div>
          </div>
        )}

        {activeSection === "triggers" && (
          <div>
            <div style={{ fontSize: 12, color: C.t2, marginBottom: 16, lineHeight: 1.6 }}>
              What makes Erebus speak without being asked. Toggle each trigger on or off.
            </div>

            {[
              { id: "time_morning", label: "🌅 Morning Greeting", desc: "Speaks when you wake up (6-9 AM)" },
              { id: "time_evening", label: "🌙 Evening Check-in", desc: "Speaks in the evening (7-10 PM)" },
              { id: "calendar", label: "📅 Calendar Events", desc: "Speaks when events change (requires integration)" },
              { id: "tasks", label: "✅ Task Completion", desc: "Celebrates when you finish tasks (requires integration)" },
              { id: "crm", label: "🎯 CRM Changes", desc: "Speaks on lead status changes (requires integration)" },
              { id: "inactivity", label: "⏳ User Inactivity", desc: "Checks in when you're quiet" },
              { id: "curiosity", label: "🧠 Erebus Curiosity", desc: "Speaks when Erebus has an idea or question" },
              { id: "context", label: "📊 Context Changes", desc: "Speaks when data patterns emerge" },
            ].map((trigger) => {
              const isActive = triggers[trigger.id as keyof TriggerSettings] || false;
              return (
                <div
                  key={trigger.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    marginBottom: 6,
                    borderRadius: 8,
                    background: isActive ? C.eDim : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? C.e + "44" : "rgba(255,255,255,0.06)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => onUpdateTrigger(trigger.id as keyof TriggerSettings, !isActive)}
                >
                  <div>
                    <div style={{ fontSize: 12, color: isActive ? C.text : C.t2 }}>
                      {trigger.label}
                    </div>
                    <div style={{ fontSize: 10, color: C.t3 }}>{trigger.desc}</div>
                  </div>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid ${isActive ? C.e : C.t3}`,
                      background: isActive ? C.e : "transparent",
                      flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                  />
                </div>
              );
            })}

            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 11,
                color: C.t3,
                lineHeight: 1.6,
              }}
            >
              💡 Calendar, Tasks, and CRM triggers require data integration.
              They'll work once Erebus has access to those systems.
            </div>
          </div>
        )}

        {activeSection === "log" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, color: C.t2 }}>
                {log.length} initiations logged
              </span>
              <button
                onClick={onClearLog}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  background: "rgba(255,79,94,0.1)",
                  border: "1px solid rgba(255,79,94,0.2)",
                  color: C.red,
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Clear Log
              </button>
            </div>

            {log.length === 0 ? (
              <div
                style={{
                  color: C.t3,
                  fontSize: 12,
                  textAlign: "center",
                  padding: "40px 0",
                }}
              >
                No initiations yet. Erebus will speak when the moment is right.
              </div>
            ) : (
              log
                .slice()
                .reverse()
                .slice(0, 30)
                .map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: "10px 14px",
                      marginBottom: 6,
                      borderRadius: 8,
                      background: C.card,
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5, fontStyle: "italic" }}>
                      "{entry.text}"
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 4,
                      }}
                    >
                      <span style={{ fontSize: 9, color: C.t3 }}>
                        {entry.tone} · {entry.trigger}
                      </span>
                      <span style={{ fontSize: 9, color: C.t3 }}>
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "—"}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes epulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}