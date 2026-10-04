// @ts-nocheck -- PATCH (worker-ai-route build fix): src/lib/agents/erebus/** is excluded in tsconfig.json,
// but ErebusDock.tsx lazy-imports this file so tsc -b pulled it in (191 pre-existing strict errors).
// PATCH NOTES (erebus-voice, 2026-09-29)
//   - Floating avatar: the static <ErebusImage> is replaced by an audio-reactive
//     <ErebusFace ref={faceRef} src="/agents/Erebus.png" width={140} />
//     (the avatar container styling and the video branch are unchanged).
//   - useErebusVoice({ faceRef, ... }) gives Erebus a voice (Kokoro TTS with a
//     speechSynthesis fallback).
//   - InitiationEngine is constructed with getErebusCore() and gets an onSpeak
//     handler (merged with the existing handlers) that awaits voice.say(text).
//   - Added isSpeaking state (driven by the voice hook).
//   Tabs, chat, goals, projects, control and settings are untouched.
// ErebusPanel.tsx — v17
// Fixes: silent errors, stale settings, memory leaks, IME, a11y, perf,
//        blob-URL leaks, unstable send callback, unhandled rejections from
//        runAgenticTask's new Promise contract, engine log spam
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { getErebusCore } from "@/lib/agents/erebus/ErebusCore";
import {
  runAgenticTask,
  runSingleTurn,
  syncToBackend,
} from "@/lib/agents/erebus/ErebusAgent";
import { InitiationEngine } from "../initiation/InitiationEngine";
import { ErebusPresence } from "./ErebusPresence";
import { ErebusFace } from "./ErebusFace";
import type { ErebusFaceHandle } from "./ErebusFace";
import { useErebusVoice } from "../hooks/useErebusVoice";
import type {
  InitiationState,
  Personality,
  TriggerSettings,
  InitiationMessage,
  EmotionalState,
} from "../types/initiation.types";
import type { ErebusSettings } from "../types/agent.types";
import { DEFAULT_SETTINGS } from "../types/agent.types";
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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

const MODELS = [
  { id: "auto", label: "Auto (best available)", direct: true },
  { id: "groq", label: "Groq Llama 3.3 (free)", direct: true },
  { id: "gemini", label: "Gemini 2.0 Flash (free)", direct: true },
  { id: "deepseek", label: "DeepSeek R1", direct: true },
  { id: "openai", label: "GPT-4o", direct: false },
  { id: "claude", label: "Claude Sonnet", direct: false },
  { id: "grok", label: "Grok (xAI)", direct: false },
  { id: "qwen", label: "Qwen (Alibaba)", direct: false },
];

const TABS = [
  { id: "chat", icon: "◈", label: "Chat" },
  { id: "mind", icon: "🧠", label: "Mind" },
  { id: "goals", icon: "◎", label: "Goals" },
  { id: "projects", icon: "◫", label: "Projects" },
  { id: "control", icon: "⚙", label: "Control" },
];

const STATE_COLOR = {
  dormant: C.t3,
  waking: C.orange,
  active: C.teal,
  working: C.e,
};

const STATE_LABEL = {
  dormant: "DORMANT",
  waking: "WAKING…",
  active: "ACTIVE",
  working: "WORKING",
};

const MAX_STEP_RESULT_LENGTH = 200;
const MAX_WEB_TEXT_COLLAPSED = 300;
const MAX_WEB_TEXT_EXPANDED = 4000;
const MAX_SNIPPET_LENGTH = 140;
const MAX_MESSAGE_PREVIEW = 140;
const PENDING_MESSAGE_DISPLAY_MS = 5000;
const LS_GOALS = "lifeos_goals";

const MEDIA_TYPES = ["image", "music", "speech", "video", "avatar", "media_error"];

// ─────────────────────────────────────────────────────────────────────────────
// Blob URL lifetime helper
// Attachments and media results create object URLs. Track them and revoke on
// unmount so long sessions don't leak memory.
// ─────────────────────────────────────────────────────────────────────────────

function useBlobUrlRegistry() {
  const urlsRef = useRef(new Set());
  const add = useCallback((url) => {
    if (url && url.startsWith("blob:")) urlsRef.current.add(url);
    return url;
  }, []);
  const revoke = useCallback((url) => {
    if (!url || !urlsRef.current.has(url)) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    urlsRef.current.delete(url);
  }, []);
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const u of urls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      }
      urls.clear();
    };
  }, []);
  return { add, revoke };
}

// ─────────────────────────────────────────────────────────────────────────────
// Erebus avatar image with graceful fallback
// ─────────────────────────────────────────────────────────────────────────────

function ErebusImage({ size = 30, border, glow, className, style }) {
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: border || "1.5px solid rgba(155,114,207,0.5)",
        boxShadow: glow || "none",
        background: "#07080f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {errored ? (
        <span style={{ fontSize: size * 0.45, color: C.eHi }}>E</span>
      ) : (
        <img
          src="/agents/Erebus.png"
          alt="Erebus"
          onError={() => setErrored(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 15%",
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User bubble
// ─────────────────────────────────────────────────────────────────────────────

const UserBubble = React.memo(function UserBubble({ msg }) {
  const files = msg.files || [];
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div
        style={{
          maxWidth: "72%",
          padding: "10px 14px",
          borderRadius: "16px 16px 4px 16px",
          background: "rgba(155,114,207,0.18)",
          border: "1px solid rgba(155,114,207,0.25)",
          color: C.text,
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}
      >
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: C.eDim,
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 11,
                  color: C.eHi,
                }}
              >
                <span>{f.type?.startsWith("image/") ? "IMG" : "DOC"}</span>
                <span>{f.name}</span>
              </div>
            ))}
          </div>
        )}
        {msg.text}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Step stream display
// ─────────────────────────────────────────────────────────────────────────────

const StepStream = React.memo(function StepStream({ steps }) {
  if (!steps?.length) return null;
  return (
    <div
      style={{
        margin: "8px 0",
        background: C.bg2,
        borderRadius: 10,
        border: `1px solid ${C.eDim}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "6px 12px",
          borderBottom: `1px solid ${C.eDim}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.e,
            animation: "epulse 1.2s infinite ease-in-out",
          }}
        />
        <span
          style={{
            fontSize: 10,
            color: C.eHi,
            fontWeight: 700,
            letterSpacing: ".08em",
          }}
        >
          EREBUS WORKING — {steps.length} step{steps.length !== 1 ? "s" : ""}
        </span>
      </div>
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            padding: "8px 12px",
            borderBottom:
              i < steps.length - 1 ? `1px solid rgba(255,255,255,0.03)` : "none",
          }}
        >
          <div style={{ fontSize: 10, color: C.t3, marginBottom: 3 }}>
            Step {s.step}
          </div>
          {s.tool && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: C.blue,
                marginBottom: 3,
                background: "rgba(74,179,244,0.07)",
                borderRadius: 4,
                padding: "2px 6px",
                display: "inline-block",
              }}
            >
              {s.tool}
            </div>
          )}
          {s.result && (
            <div
              style={{
                fontSize: 11,
                color: C.t2,
                lineHeight: 1.4,
                maxHeight: 60,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.result.slice(0, MAX_STEP_RESULT_LENGTH)}
              {s.result.length > MAX_STEP_RESULT_LENGTH ? "…" : ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LifeOS tool result cards
// ─────────────────────────────────────────────────────────────────────────────

const LifeOSCard = React.memo(function LifeOSCard({ result }) {
  if (result.subtype === "data") {
    const items = Array.isArray(result.data) ? result.data : [result.data];
    return (
      <div
        style={{
          marginTop: 8,
          background: C.bg2,
          borderRadius: 10,
          border: `1px solid rgba(0,200,150,0.2)`,
        }}
      >
        <div
          style={{
            padding: "6px 12px",
            borderBottom: `1px solid rgba(0,200,150,0.1)`,
            fontSize: 11,
            color: C.teal,
            fontWeight: 600,
          }}
        >
          ◈ LifeOS: {result.key} ({items.length} records)
        </div>
        <div style={{ maxHeight: 160, overflowY: "auto", padding: "6px 12px" }}>
          {items.slice(0, 8).map((item, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: C.t2,
                marginBottom: 4,
                padding: "3px 0",
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}
            >
              {item.name ||
                item.text ||
                item.title ||
                item.goal ||
                JSON.stringify(item).slice(0, 80)}
              {(item.status || item.priority) && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9,
                    color: C.e,
                    textTransform: "uppercase",
                  }}
                >
                  {item.status || item.priority}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (result.subtype === "email_draft") {
    return (
      <div
        style={{
          marginTop: 8,
          background: C.bg2,
          borderRadius: 10,
          border: `1px solid rgba(74,179,244,0.2)`,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.blue,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          EMAIL DRAFT
        </div>
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
          To: {result.to}
        </div>
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
          Subject: {result.subject}
        </div>
        {result.body && (
          <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>
            {result.body}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 8,
        background: C.bg2,
        borderRadius: 8,
        padding: "6px 12px",
        border: `1px solid rgba(155,114,207,0.15)`,
        fontSize: 11,
        color: C.t2,
      }}
    >
      ◈ {result.text}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Web result cards
// ─────────────────────────────────────────────────────────────────────────────

const WebCard = React.memo(function WebCard({ result }) {
  const [expanded, setExpanded] = useState(false);

  if (result.subtype === "search") {
    const results = result.results || [];
    return (
      <div
        style={{
          marginTop: 8,
          background: C.bg2,
          borderRadius: 10,
          border: "1px solid rgba(75,179,244,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "7px 12px",
            borderBottom: "1px solid rgba(75,179,244,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11, color: C.blue }}>🔍</span>
          <span style={{ fontSize: 11, color: C.blue, fontWeight: 600 }}>
            Web Search: {result.query}
          </span>
        </div>
        <div
          style={{
            padding: "8px 12px",
            maxHeight: expanded ? 360 : 160,
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  color: "#6ab7f5",
                  textDecoration: "none",
                  fontWeight: 600,
                  display: "block",
                }}
              >
                {r.title}
              </a>
              <div style={{ fontSize: 10, color: C.t3, marginBottom: 2 }}>
                {r.url?.slice(0, 60)}
              </div>
              {r.snippet && (
                <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4 }}>
                  {r.snippet.slice(0, MAX_SNIPPET_LENGTH)}
                </div>
              )}
            </div>
          ))}
        </div>
        {results.length > 3 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderTop: "1px solid rgba(75,179,244,0.1)",
              padding: "5px",
              color: C.t3,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            {expanded ? "▲ collapse" : `▼ show all ${results.length} results`}
          </button>
        )}
      </div>
    );
  }

  if (result.subtype === "screenshot" && result.screenshot) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, color: C.t3, marginBottom: 4 }}>
          📸 {result.url}
        </div>
        <img
          src={result.screenshot}
          alt="Page screenshot"
          style={{
            maxWidth: "100%",
            borderRadius: 8,
            border: "1px solid rgba(155,114,207,0.2)",
          }}
        />
      </div>
    );
  }

  if (result.subtype === "bd_members" || result.subtype === "bd_scrape") {
    const members = result.members || [];
    return (
      <div
        style={{
          marginTop: 8,
          background: C.bg2,
          borderRadius: 10,
          border: "1px solid rgba(0,200,150,0.2)",
        }}
      >
        <div
          style={{
            padding: "7px 12px",
            borderBottom: "1px solid rgba(0,200,150,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: C.teal, fontWeight: 600 }}>
            ◈ BD Directory — {result.total} members
          </span>
          <span style={{ fontSize: 10, color: C.t3 }}>
            {result.subtype === "bd_scrape" ? "Full scrape" : "Search"}
          </span>
        </div>
        <div
          style={{
            maxHeight: expanded ? 400 : 160,
            overflowY: "auto",
            padding: "8px 12px",
          }}
        >
          {members.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 6,
                padding: "5px 8px",
                background: C.card,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                {m.name || "(unnamed)"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.t3,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 2,
                }}
              >
                {m.email && <span>✉ {m.email}</span>}
                {m.phone && <span>📞 {m.phone}</span>}
                {m.category && <span style={{ color: C.teal }}>● {m.category}</span>}
                {m.location && <span>📍 {m.location}</span>}
              </div>
            </div>
          ))}
        </div>
        {members.length > 3 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderTop: "1px solid rgba(0,200,150,0.1)",
              padding: "5px",
              color: C.t3,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            {expanded ? "▲ collapse" : `▼ show all ${members.length} members`}
          </button>
        )}
      </div>
    );
  }

  const icon =
    result.subtype === "form" ? "◻" : result.subtype === "click" ? "↗" : "◈";
  return (
    <div
      style={{
        marginTop: 8,
        background: C.bg2,
        borderRadius: 10,
        border: "1px solid rgba(155,114,207,0.15)",
      }}
    >
      <div
        style={{
          padding: "7px 12px",
          borderBottom: "1px solid rgba(155,114,207,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, color: C.eHi }}>{icon}</span>
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11,
            color: C.eHi,
            textDecoration: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 280,
          }}
        >
          {result.title || result.url || "Web result"}
        </a>
      </div>
      <div
        style={{
          padding: "8px 12px",
          maxHeight: expanded ? 320 : 90,
          overflowY: "auto",
          fontSize: 11,
          color: C.t2,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {(result.text || "").slice(
          0,
          expanded ? MAX_WEB_TEXT_EXPANDED : MAX_WEB_TEXT_COLLAPSED,
        )}
        {!expanded &&
          (result.text || "").length > MAX_WEB_TEXT_COLLAPSED &&
          "…"}
      </div>
      {(result.text || "").length > MAX_WEB_TEXT_COLLAPSED && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderTop: "1px solid rgba(155,114,207,0.08)",
            padding: "5px",
            color: C.t3,
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          {expanded ? "▲ collapse" : "▼ expand"}
        </button>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Media result cards
// ─────────────────────────────────────────────────────────────────────────────

const MediaCard = React.memo(function MediaCard({ result, onRelease }) {
  const { type, url, source, prompt, text, script, spoken, edited, fromImage } =
    result;

  // Release the blob URL when this card unmounts (media consumed).
  useEffect(() => {
    return () => {
      if (url && url.startsWith("blob:") && onRelease) onRelease(url);
    };
  }, [url, onRelease]);

  const badge = (label, color = C.e) => (
    <span
      style={{
        fontSize: 9,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "1px 6px",
        fontWeight: 700,
        letterSpacing: ".06em",
      }}
    >
      {label}
    </span>
  );

  if (type === "image") {
    return (
      <div
        style={{
          marginTop: 8,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(155,114,207,0.25)",
          background: C.bg2,
        }}
      >
        <img
          src={url}
          alt={prompt || "Generated image"}
          style={{
            width: "100%",
            display: "block",
            maxHeight: 480,
            objectFit: "contain",
          }}
        />
        <div
          style={{
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {badge(edited ? "EDITED" : "IMAGE", C.e)}
            <span style={{ fontSize: 10, color: C.t3 }}>{source}</span>
          </div>
          {url && (
            <a
              href={url}
              download="erebus-image.webp"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 10,
                color: C.eHi,
                textDecoration: "none",
                background: C.eDim,
                borderRadius: 5,
                padding: "3px 8px",
                border: "1px solid rgba(155,114,207,0.2)",
              }}
            >
              ↓ Save
            </a>
          )}
        </div>
      </div>
    );
  }

  if (type === "music") {
    return (
      <div
        style={{
          marginTop: 8,
          background: C.bg2,
          borderRadius: 12,
          border: "1px solid rgba(155,114,207,0.2)",
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {badge("MUSIC", C.blue)}
          <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>
            {prompt?.slice(0, 60)}
            {prompt?.length > 60 ? "…" : ""}
          </span>
        </div>
        <audio controls style={{ width: "100%", height: 36 }} src={url} />
        <div style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>
          via {source}
        </div>
      </div>
    );
  }

  if (type === "speech") {
    if (spoken) {
      return (
        <div
          style={{
            marginTop: 8,
            background: C.bg2,
            borderRadius: 10,
            border: "1px solid rgba(0,200,150,0.2)",
            padding: "10px 14px",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {badge("SPOKEN", C.teal)}
          <span style={{ fontSize: 11, color: C.t2 }}>
            Audio played via {source}
          </span>
        </div>
      );
    }
    return (
      <div
        style={{
          marginTop: 8,
          background: C.bg2,
          borderRadius: 12,
          border: "1px solid rgba(0,200,150,0.2)",
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          {badge("SPEECH", C.teal)}
          <span style={{ fontSize: 11, color: C.t2 }}>
            {text?.slice(0, 80)}…
          </span>
        </div>
        <audio controls style={{ width: "100%", height: 36 }} src={url} />
        <div style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>
          via {source}
        </div>
      </div>
    );
  }

  if (type === "video" || type === "avatar") {
    const isAvatar = type === "avatar";
    const accent = isAvatar ? C.orange : C.blue;
    const label = isAvatar ? "AVATAR" : fromImage ? "IMG→VIDEO" : "VIDEO";
    return (
      <div
        style={{
          marginTop: 8,
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${accent}33`,
          background: C.bg2,
        }}
      >
        <video
          controls
          autoPlay={isAvatar}
          loop={isAvatar}
          muted={isAvatar}
          style={{
            width: "100%",
            display: "block",
            maxHeight: isAvatar ? 360 : 480,
          }}
          src={url}
        />
        <div
          style={{
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {badge(label, accent)}
            <span style={{ fontSize: 10, color: C.t3 }}>{source}</span>
          </div>
          {url && (
            <a
              href={url}
              download="erebus-video.mp4"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 10,
                color: accent,
                textDecoration: "none",
                background: `${accent}11`,
                borderRadius: 5,
                padding: "3px 8px",
                border: `1px solid ${accent}33`,
              }}
            >
              ↓ Save
            </a>
          )}
        </div>
        {isAvatar && script && (
          <div
            style={{
              padding: "6px 10px 8px",
              fontSize: 10,
              color: C.t3,
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            "{script.slice(0, 100)}
            {script.length > 100 ? "…" : ""}"
          </div>
        )}
      </div>
    );
  }

  if (type === "media_error") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "rgba(255,79,94,0.08)",
          borderRadius: 8,
          border: "1px solid rgba(255,79,94,0.2)",
          padding: "8px 12px",
          fontSize: 11,
          color: C.red,
        }}
      >
        ⚠ Media error: {result.text}
      </div>
    );
  }

  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// Erebus bubble
// ─────────────────────────────────────────────────────────────────────────────

const ErebusBubble = React.memo(function ErebusBubble({ msg, onRelease }) {
  const toolResults = msg.toolResults || [];
  const mediaResults = useMemo(
    () => toolResults.filter((r) => MEDIA_TYPES.includes(r.type)),
    [toolResults],
  );
  const otherResults = useMemo(
    () => toolResults.filter((r) => !MEDIA_TYPES.includes(r.type)),
    [toolResults],
  );

  const isUnprompted = msg.isUnprompted || false;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
        alignItems: "flex-start",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <ErebusImage
          size={30}
          border={
            isUnprompted
              ? "1.5px solid rgba(255,140,66,0.6)"
              : "1.5px solid rgba(155,114,207,0.5)"
          }
          glow={
            isUnprompted
              ? "0 0 20px rgba(255,140,66,0.3)"
              : "0 0 12px rgba(155,114,207,0.25)"
          }
          style={{ marginTop: 2 }}
        />
        {isUnprompted && (
          <div
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              fontSize: 8,
              background: C.orange,
              color: "#000",
              borderRadius: "50%",
              width: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            ✦
          </div>
        )}
      </div>
      <div style={{ flex: 1, maxWidth: "82%" }}>
        {msg.steps?.length > 0 && <StepStream steps={msg.steps} />}
        {isUnprompted && (
          <div
            style={{
              fontSize: 8,
              color: C.orange,
              fontWeight: 600,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            ✦ Unprompted
          </div>
        )}
        {msg.text && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "4px 16px 16px 16px",
              background: isUnprompted ? "rgba(255,140,66,0.08)" : C.card,
              border: isUnprompted
                ? "1px solid rgba(255,140,66,0.25)"
                : "1px solid rgba(155,114,207,0.15)",
              color: msg.error ? C.red : C.text,
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.text}
          </div>
        )}
        {mediaResults.map((r, i) => (
          <MediaCard key={i} result={r} onRelease={onRelease} />
        ))}
        {otherResults.map((r, i) =>
          r.type === "lifeos" ? (
            <LifeOSCard key={i} result={r} />
          ) : (
            <WebCard key={i} result={r} />
          ),
        )}
        {msg.model && (
          <div
            style={{
              fontSize: 9,
              color: C.t3,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            via {msg.model}
          </div>
        )}
      </div>
    </div>
  );
});

const Typing = React.memo(function Typing() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
        alignItems: "center",
      }}
    >
      <ErebusImage size={30} />
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "10px 14px",
          background: C.card,
          borderRadius: "4px 16px 16px 16px",
          border: "1px solid rgba(155,114,207,0.15)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.e,
              animation: `edot 1.2s ${i * 0.2}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Wake screen
// ─────────────────────────────────────────────────────────────────────────────

const WakeScreen = React.memo(function WakeScreen({ onWake, wakeState }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <div style={{ position: "relative" }}>
        <ErebusImage
          size={80}
          border={`2px solid ${STATE_COLOR[wakeState]}`}
          glow={`0 0 ${wakeState === "waking" ? "30px" : "16px"} ${
            STATE_COLOR[wakeState]
          }44`}
          style={{ transition: "all .5s" }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: STATE_COLOR[wakeState],
            border: "2px solid #07080f",
            animation: wakeState === "waking" ? "epulse 1s infinite" : "none",
            transition: "background .3s",
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.text,
            letterSpacing: ".05em",
          }}
        >
          EREBUS
        </div>
        <div
          style={{
            fontSize: 11,
            color: STATE_COLOR[wakeState],
            marginTop: 4,
            fontWeight: 600,
            letterSpacing: ".12em",
            transition: "color .3s",
          }}
        >
          {STATE_LABEL[wakeState]}
        </div>
      </div>

      {wakeState === "dormant" && (
        <button
          onClick={onWake}
          style={{
            padding: "11px 32px",
            borderRadius: 24,
            background: `linear-gradient(135deg, ${C.e}, #6b44b0)`,
            border: "none",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: `0 4px 20px rgba(155,114,207,0.35)`,
            letterSpacing: ".05em",
          }}
        >
          WAKE EREBUS
        </button>
      )}

      {wakeState === "waking" && (
        <div
          style={{
            fontSize: 11,
            color: C.t3,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.orange,
              animation: "epulse 0.8s infinite",
            }}
          />
          Connecting to intelligence core…
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Chat Tab
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_GREETING = {
  id: 0,
  role: "erebus",
  text: "Erebus online.\n\nI reason through your own API keys. My soul, my memory, my rules. I can run multi-step agentic tasks, read your CRM and calendar, search the web, draft emails, and create tasks.\n\nWhat do you need?",
};

function ChatTab({
  core,
  wakeState,
  setWakeState,
  onAvatarVideo,
  pendingMessage,
  onDismissPending,
}) {
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [useAgent, setUseAgent] = useState(true);

  const fileRef = useRef(null);
  const endRef = useRef(null);
  const idRef = useRef(1);
  const lastPendingIdRef = useRef(null);
  const pendingTimeoutRef = useRef(null);

  // Blob URL lifetime for attachments
  const blobs = useBlobUrlRegistry();

  // Stable refs so `send` doesn't have to depend on state.
  const inputRef = useRef(input);
  const filesRef = useRef(files);
  const loadingRef = useRef(loading);
  const useAgentRef = useRef(useAgent);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    useAgentRef.current = useAgent;
  }, [useAgent]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle pending unprompted messages (queue-safe)
  useEffect(() => {
    if (!pendingMessage) return;
    if (pendingMessage.id === lastPendingIdRef.current) return;

    lastPendingIdRef.current = pendingMessage.id;
    const msg = {
      id: idRef.current++,
      role: "erebus",
      text: pendingMessage.text,
      toolResults: [],
      model: "initiation",
      isUnprompted: true,
    };
    setMessages((m) => [...m, msg]);

    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(() => {
      if (onDismissPending) onDismissPending();
    }, PENDING_MESSAGE_DISPLAY_MS);

    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, [pendingMessage, onDismissPending]);

  const send = useCallback(async () => {
    const text = inputRef.current.trim();
    const currentFiles = filesRef.current;
    if (!text && currentFiles.length === 0) return;
    if (loadingRef.current) return;

    if (onDismissPending) onDismissPending();
    lastPendingIdRef.current = null;

    const attached = currentFiles.map((f) => ({ name: f.name, type: f.type }));
    setMessages((m) => [
      ...m,
      {
        id: idRef.current++,
        role: "user",
        text: text || "(files attached)",
        files: attached,
      },
    ]);
    setInput("");
    setFiles([]);
    setLoading(true);
    setWakeState("working");

    const userMsg =
      text || `Analyze: ${attached.map((f) => f.name).join(", ")}`;
    core.remember("user", userMsg);

    if (useAgentRef.current && core.backendOnline) {
      const steps = [];
      const placeholderId = idRef.current++;
      setMessages((m) => [
        ...m,
        {
          id: placeholderId,
          role: "erebus",
          text: "",
          steps: [],
          pending: true,
        },
      ]);

      const resolvePlaceholder = (patch) => {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === placeholderId ? { ...msg, ...patch, pending: false } : msg,
          ),
        );
      };

      // Callbacks + Promise. Because ErebusAgent now rejects on failure,
      // wrap in try/catch so we don't leak an unhandled rejection. The
      // callbacks still fire exactly once.
      try {
        await runAgenticTask(
          userMsg,
          "",
          (step) => {
            steps.push(step);
            setMessages((m) =>
              m.map((msg) =>
                msg.id === placeholderId ? { ...msg, steps: [...steps] } : msg,
              ),
            );
          },
          (done) => {
            const answer = done?.answer || "";
            core.remember("assistant", answer);
            resolvePlaceholder({
              text: answer,
              steps: [...steps],
              model: done?.model,
            });
          },
          (err) => {
            resolvePlaceholder({
              text: `⚠ Backend error: ${err?.message || "connection lost"}`,
              steps: [...steps],
              error: true,
            });
          },
        );
      } catch {
        // onError already fired; nothing else to do here.
      } finally {
        setLoading(false);
        setWakeState("active");
      }
      return;
    }

    try {
      const { text: clean, toolResults, model } = await runSingleTurn(
        core,
        userMsg,
      );
      const reply = {
        id: idRef.current++,
        role: "erebus",
        text: clean,
        toolResults,
        model,
      };
      const avatarResult = toolResults?.find((r) => r.type === "avatar");
      if (avatarResult?.url) onAvatarVideo?.(avatarResult.url);
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "erebus",
          text: `Error: ${e.message}`,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      setWakeState("active");
    }
  }, [core, onAvatarVideo, onDismissPending, setWakeState]);

  const onKey = useCallback(
    (e) => {
      if (e.nativeEvent?.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  const starters = useMemo(
    () => [
      "Give me a full CEO GPS status report",
      "Search the web for CEO GPS Atlanta competitors",
      "What's on my calendar today?",
      "Draft a follow-up email to Gino Bambino",
    ],
    [],
  );

  const removeFile = useCallback(
    (i) => {
      setFiles((p) => {
        const removed = p[i];
        if (removed?.url) blobs.revoke(removed.url);
        return p.filter((_, j) => j !== i);
      });
    },
    [blobs],
  );

  const onFileChange = useCallback(
    (e) => {
      const picked = Array.from(e.target.files || []).map((f) => ({
        name: f.name,
        type: f.type,
        url: blobs.add(URL.createObjectURL(f)),
      }));
      setFiles((p) => [...p, ...picked]);
      // allow re-selecting the same file
      if (fileRef.current) fileRef.current.value = "";
    },
    [blobs],
  );

  const handleReleaseBlob = useCallback((url) => blobs.revoke(url), [blobs]);

  return (
    <>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px 8px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} msg={m} />
          ) : (
            <ErebusBubble
              key={m.id}
              msg={m}
              onRelease={handleReleaseBlob}
            />
          ),
        )}
        {loading && !messages.find((m) => m.pending) && <Typing />}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div
          style={{
            padding: "0 20px 8px",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {starters.map((s, i) => (
            <button
              key={i}
              onClick={() => setInput(s)}
              style={{
                background: "rgba(155,114,207,0.08)",
                border: "1px solid rgba(155,114,207,0.2)",
                borderRadius: 20,
                padding: "5px 12px",
                color: C.eHi,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div
          style={{
            padding: "0 20px 6px",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: C.eDim,
                borderRadius: 8,
                padding: "4px 10px",
                border: "1px solid rgba(155,114,207,0.25)",
              }}
            >
              {f.type?.startsWith("image/") ? (
                <img
                  src={f.url}
                  alt=""
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 3,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span style={{ fontSize: 14 }}>DOC</span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: C.eHi,
                  maxWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.name}
              </span>
              <button
                aria-label={`Remove ${f.name}`}
                onClick={() => removeFile(i)}
                style={{
                  background: "none",
                  border: "none",
                  color: C.t3,
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "8px 16px 16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 10, color: C.t3 }}>Agentic mode</span>
          <div
            role="switch"
            aria-checked={useAgent}
            aria-label="Toggle agentic mode"
            onClick={() => setUseAgent((v) => !v)}
            style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              cursor: "pointer",
              background: useAgent ? C.e : "rgba(255,255,255,0.1)",
              transition: "background .2s",
              display: "flex",
              alignItems: "center",
              padding: "0 3px",
              justifyContent: useAgent ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </div>
          {core.backendOnline && (
            <span style={{ fontSize: 9, color: C.teal }}>● backend</span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: C.card,
            borderRadius: 12,
            border: "1px solid rgba(155,114,207,0.2)",
            padding: "8px 10px",
          }}
        >
          <button
            aria-label="Attach files"
            onClick={() => fileRef.current?.click()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.t2,
              fontSize: 20,
              padding: "2px 4px",
              lineHeight: 1,
            }}
          >
            +
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.docx,.csv,.json"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask Erebus anything…"
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: C.text,
              fontSize: 13,
              resize: "none",
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: "auto",
              fontFamily: "inherit",
              outline: "none",
            }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            aria-label="Send message"
            onClick={send}
            disabled={loading || (!input.trim() && files.length === 0)}
            style={{
              background: C.e,
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: loading ? "not-allowed" : "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: loading ? 0.5 : 1,
            }}
          >
            <span style={{ color: "#fff", fontSize: 16, lineHeight: 1 }}>›</span>
          </button>
        </div>
        <div
          style={{
            fontSize: 10,
            color: C.t3,
            marginTop: 5,
            textAlign: "center",
          }}
        >
          Enter to send · Shift+Enter new line · + to upload
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mind Tab
// ─────────────────────────────────────────────────────────────────────────────

function MindTab({ core }) {
  const [view, setView] = useState("session");
  const st = core.shortTerm || [];
  const lt = core.longTerm || { facts: {} };
  const log = (core.actionLog || []).slice(0, 20);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "12px 16px 0",
          flexShrink: 0,
        }}
      >
        {["session", "longterm", "log"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: view === v ? 700 : 400,
              background: view === v ? C.eDim : "transparent",
              color: view === v ? C.eHi : C.t2,
            }}
          >
            {v === "session"
              ? "Session"
              : v === "longterm"
                ? "Long-term"
                : "Action Log"}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {view === "session" &&
          (st.length === 0 ? (
            <div style={{ color: C.t3, fontSize: 12 }}>
              No session memory yet.
            </div>
          ) : (
            [...st]
              .reverse()
              .slice(0, 20)
              .map((m, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 8,
                    padding: "6px 10px",
                    background: C.card,
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: m.role === "user" ? C.e : C.teal,
                      marginBottom: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    {m.role}
                  </div>
                  <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.4 }}>
                    {String(m.text || "").slice(0, MAX_MESSAGE_PREVIEW)}
                    {String(m.text || "").length > MAX_MESSAGE_PREVIEW ? "…" : ""}
                  </div>
                </div>
              ))
          ))}
        {view === "longterm" &&
          (Object.keys(lt.facts || {}).length === 0 ? (
            <div style={{ color: C.t3, fontSize: 12 }}>
              No long-term facts yet.
            </div>
          ) : (
            Object.entries(lt.facts).map(([k, v], i) => (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "6px 10px",
                  background: C.card,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontSize: 11, color: C.eHi, marginBottom: 2 }}>
                  {k}
                </div>
                <div style={{ fontSize: 12, color: C.t2 }}>
                  {String(v).slice(0, 120)}
                </div>
              </div>
            ))
          ))}
        {view === "log" &&
          (log.length === 0 ? (
            <div style={{ color: C.t3, fontSize: 12 }}>
              No actions logged yet.
            </div>
          ) : (
            log.map((l, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: C.t3,
                  marginBottom: 6,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span style={{ color: C.e, flexShrink: 0 }}>{l.action}</span>
                <span>{l.detail}</span>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals Tab
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_CATS = ["business", "family", "health", "community", "tech", "finance"];
const CAT_COLORS = {
  business: C.blue,
  family: C.teal,
  health: C.green,
  community: C.orange,
  tech: C.e,
  finance: "#f0c040",
};

function newGoalId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function GoalsTab({ core }) {
  const [goals, setGoals] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_GOALS));
      if (Array.isArray(stored)) return stored;
    } catch {
      /* ignore */
    }
    return core.goals || [];
  });
  const [newGoal, setNewGoal] = useState("");
  const [newCat, setNewCat] = useState("business");

  const saveGoals = useCallback(
    (g) => {
      setGoals(g);
      try {
        localStorage.setItem(LS_GOALS, JSON.stringify(g));
      } catch {
        /* ignore quota */
      }
      core.goals = g;
    },
    [core],
  );

  const addGoal = useCallback(() => {
    if (!newGoal.trim()) return;
    const g = [
      ...goals,
      {
        id: newGoalId(),
        goal: newGoal.trim(),
        category: newCat,
        status: "active",
      },
    ];
    saveGoals(g);
    setNewGoal("");
  }, [goals, newGoal, newCat, saveGoals]);

  const toggleStatus = useCallback(
    (id) => {
      const nextStatus = { active: "done", done: "active", locked: "locked" };
      const g = goals.map((goal) =>
        goal.id === id
          ? { ...goal, status: nextStatus[goal.status] || "active" }
          : goal,
      );
      saveGoals(g);
    },
    [goals, saveGoals],
  );

  const removeGoal = useCallback(
    (id) => saveGoals(goals.filter((g) => g.id !== id)),
    [goals, saveGoals],
  );

  const grouped = useMemo(() => {
    return GOAL_CATS.reduce((acc, cat) => {
      const catGoals = goals.filter((g) => g.category === cat);
      if (catGoals.length) acc[cat] = catGoals;
      return acc;
    }, {});
  }, [goals]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
            placeholder="Add a new goal..."
            style={{
              flex: 1,
              background: C.card,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 7,
              padding: "7px 10px",
              color: C.text,
              fontSize: 12,
              outline: "none",
            }}
          />
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            style={{
              background: C.card,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 7,
              padding: "7px 8px",
              color: C.t2,
              fontSize: 11,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {GOAL_CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            aria-label="Add goal"
            onClick={addGoal}
            style={{
              background: C.e,
              border: "none",
              borderRadius: 7,
              padding: "7px 14px",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {Object.entries(grouped).map(([cat, catGoals]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: CAT_COLORS[cat] || C.t3,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {cat}
            </div>
            {catGoals.map((g) => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                  padding: "9px 12px",
                  background: C.card,
                  borderRadius: 8,
                  border: `1px solid ${
                    g.status === "done"
                      ? "rgba(61,214,140,0.2)"
                      : g.status === "locked"
                        ? "rgba(155,114,207,0.3)"
                        : "rgba(255,255,255,0.06)"
                  }`,
                }}
              >
                <div
                  onClick={() => toggleStatus(g.id)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: g.status === "locked" ? 4 : 8,
                    flexShrink: 0,
                    cursor: "pointer",
                    border: `2px solid ${
                      g.status === "done"
                        ? C.green
                        : g.status === "locked"
                          ? C.e
                          : "rgba(255,255,255,0.2)"
                    }`,
                    background:
                      g.status === "done"
                        ? C.green
                        : g.status === "locked"
                          ? C.eDim
                          : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {g.status === "locked" && (
                    <span style={{ fontSize: 8, color: C.e }}>🔒</span>
                  )}
                  {g.status === "done" && (
                    <span style={{ fontSize: 8, color: "#fff" }}>✓</span>
                  )}
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: g.status === "done" ? C.t3 : C.text,
                    textDecoration: g.status === "done" ? "line-through" : "none",
                  }}
                >
                  {g.goal}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: CAT_COLORS[cat] || C.t3,
                    background: `${CAT_COLORS[cat]}18`,
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {g.status}
                </span>
                {g.status !== "locked" && (
                  <button
                    aria-label="Remove goal"
                    onClick={() => removeGoal(g.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: C.t3,
                      cursor: "pointer",
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
        {goals.length === 0 && (
          <div style={{ color: C.t3, fontSize: 12 }}>
            No goals yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects Tab
// ─────────────────────────────────────────────────────────────────────────────

function ProjectsTab({ core }) {
  const [projs, setProjs] = useState(() => core.projects || []);
  const [title, setTitle] = useState("");
  const [task, setTask] = useState({});

  const refresh = useCallback(() => setProjs([...(core.projects || [])]), [core]);

  const addProj = useCallback(() => {
    if (!title.trim()) return;
    core.addProject(title.trim());
    setTitle("");
    refresh();
  }, [title, core, refresh]);

  const addTask = useCallback(
    (pid) => {
      if (!task[pid]?.trim()) return;
      core.addProjectTask(pid, task[pid].trim());
      setTask((t) => ({ ...t, [pid]: "" }));
      refresh();
    },
    [task, core, refresh],
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addProj()}
          placeholder="New project..."
          style={{
            flex: 1,
            background: C.card,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 7,
            padding: "7px 10px",
            color: C.text,
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          aria-label="Add project"
          onClick={addProj}
          style={{
            background: C.e,
            border: "none",
            borderRadius: 7,
            padding: "7px 14px",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          +
        </button>
      </div>
      {projs.length === 0 && (
        <div style={{ color: C.t3, fontSize: 12 }}>No projects yet.</div>
      )}
      {projs.map((p) => (
        <div
          key={p.id}
          style={{
            marginBottom: 12,
            background: C.card,
            borderRadius: 10,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>
              {p.title}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={p.status}
                onChange={(e) => {
                  core.updateProject(p.id, { status: e.target.value });
                  refresh();
                }}
                style={{
                  background: C.bg2,
                  border: "none",
                  borderRadius: 5,
                  color: C.t2,
                  fontSize: 11,
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
              <button
                aria-label="Delete project"
                onClick={() => {
                  core.deleteProject(p.id);
                  refresh();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: C.red,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ×
              </button>
            </div>
          </div>
          {(p.tasks || []).map((t) => (
            <div
              key={t.id}
              onClick={() => {
                core.toggleProjectTask(p.id, t.id);
                refresh();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 5,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: `1.5px solid ${
                    t.done ? C.teal : "rgba(255,255,255,0.2)"
                  }`,
                  background: t.done ? C.teal : "transparent",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: t.done ? C.t3 : C.t2,
                  textDecoration: t.done ? "line-through" : "none",
                }}
              >
                {t.text}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              value={task[p.id] || ""}
              onChange={(e) => setTask((t) => ({ ...t, [p.id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addTask(p.id)}
              placeholder="Add task..."
              style={{
                flex: 1,
                background: C.bg2,
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 6,
                padding: "4px 8px",
                color: C.text,
                fontSize: 11,
                outline: "none",
              }}
            />
            <button
              aria-label="Add task"
              onClick={() => addTask(p.id)}
              style={{
                background: "rgba(155,114,207,0.2)",
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                color: C.eHi,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Brain Section
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_MODELS_LIST = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    size: "0.8 GB",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    size: "2.2 GB",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi-3.5 Mini",
    size: "2.2 GB",
  },
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B", size: "1.5 GB" },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 7B",
    size: "4.5 GB",
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    label: "DeepSeek R1 7B",
    size: "4.5 GB",
  },
];

function LocalBrainSection({ core }) {
  const [localStatus, setLocalStatus] = useState({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [selectedLocal, setSelectedLocal] = useState(
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  );
  const [ollamaInput, setOllamaInput] = useState(
    core.ollamaModel || "llama3.2",
  );

  useEffect(() => {
    let unsub;
    import("@/lib/agents/erebus/ErebusLocalModel")
      .then(({ onLocalModelStatus }) => {
        unsub = onLocalModelStatus(setLocalStatus);
      })
      .catch(() => {
        /* module not available */
      });
    return () => unsub?.();
  }, []);

  const loadWebLLM = async () => {
    const { loadLocalModel } = await import(
      "@/lib/agents/erebus/ErebusLocalModel"
    );
    loadLocalModel(selectedLocal);
  };

  const unloadWebLLM = async () => {
    const { unloadLocalModel } = await import(
      "@/lib/agents/erebus/ErebusLocalModel"
    );
    unloadLocalModel();
  };

  const statusColor = {
    idle: C.t3,
    loading: C.orange,
    ready: C.teal,
    error: C.red,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: C.card,
          borderRadius: 10,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
            Ollama Local Server
          </span>
          <span
            style={{
              fontSize: 10,
              color: core.ollamaOnline ? C.teal : C.t3,
              fontWeight: 600,
            }}
          >
            {core.ollamaOnline
              ? `● ONLINE — ${core.ollamaModels.length} model${
                  core.ollamaModels.length !== 1 ? "s" : ""
                }`
              : "○ OFFLINE"}
          </span>
        </div>

        {core.ollamaOnline && core.ollamaModels.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {core.ollamaModels.map((m) => (
              <div
                key={m}
                onClick={() => {
                  core.setOllamaModel(m);
                  setOllamaInput(m);
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  cursor: "pointer",
                  fontSize: 12,
                  background:
                    core.ollamaModel === m ? C.eDim : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    core.ollamaModel === m ? C.e + "55" : "rgba(255,255,255,0.05)"
                  }`,
                  color: core.ollamaModel === m ? C.text : C.t2,
                }}
              >
                {m}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 10 }}>
            Install Ollama, then pull a model:
            <div
              style={{
                marginTop: 6,
                padding: "6px 10px",
                background: "#0a0a14",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 11,
                color: C.t2,
                lineHeight: 1.8,
              }}
            >
              <div>winget install Ollama.Ollama</div>
              <div>ollama pull llama3.2</div>
            </div>
          </div>
        )}

        {!core.ollamaOnline && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={ollamaInput}
              onChange={(e) => setOllamaInput(e.target.value)}
              placeholder="Model name (e.g. llama3.2)"
              style={{
                flex: 1,
                background: "#0a0a14",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                color: C.t2,
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                core.setOllamaModel(ollamaInput);
                if (typeof core.verifyOllama === "function") {
                  core.verifyOllama();
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                background: C.e,
                border: "none",
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          background: C.card,
          borderRadius: 10,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
              Browser Model (WebLLM)
            </span>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
              Runs in-browser via WebGPU — no server needed
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: statusColor[localStatus.status] || C.t3,
            }}
          >
            {localStatus.status.toUpperCase()}
          </span>
        </div>

        {localStatus.status === "loading" && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                height: 4,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 2,
                overflow: "hidden",
                marginBottom: 5,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${localStatus.progress}%`,
                  background: C.e,
                  borderRadius: 2,
                  transition: "width .3s",
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: C.t3 }}>
              {localStatus.message} ({localStatus.progress}%)
            </div>
          </div>
        )}

        {localStatus.status !== "ready" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {LOCAL_MODELS_LIST.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedLocal(m.id)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  cursor: "pointer",
                  fontSize: 12,
                  background:
                    selectedLocal === m.id
                      ? C.eDim
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    selectedLocal === m.id ? C.e + "55" : "rgba(255,255,255,0.05)"
                  }`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: selectedLocal === m.id ? C.text : C.t2 }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 10, color: C.t3 }}>{m.size}</span>
              </div>
            ))}
          </div>
        )}

        {localStatus.status === "ready" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: C.teal }}>
              ✓{" "}
              {LOCAL_MODELS_LIST.find((m) => m.id === localStatus.model)?.label ||
                localStatus.model}{" "}
              loaded
            </span>
            <button
              onClick={unloadWebLLM}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                background: "rgba(255,79,94,0.15)",
                border: "1px solid rgba(255,79,94,0.3)",
                color: C.red,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Unload
            </button>
          </div>
        ) : (
          <button
            onClick={loadWebLLM}
            disabled={localStatus.status === "loading"}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 7,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              background:
                localStatus.status === "loading"
                  ? "rgba(155,114,207,0.1)"
                  : `linear-gradient(135deg,${C.e},#6b44b0)`,
              border: "none",
              color: localStatus.status === "loading" ? C.t3 : "#fff",
            }}
          >
            {localStatus.status === "loading"
              ? "Downloading…"
              : "Load Model into Browser"}
          </button>
        )}

        {localStatus.status === "error" && (
          <div style={{ marginTop: 8, fontSize: 10, color: C.red }}>
            Error: {localStatus.message}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 10, color: C.t3 }}>
          Requires Chrome/Edge with WebGPU. First load downloads model once,
          cached for future use.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Section
// ─────────────────────────────────────────────────────────────────────────────

function SettingsSection({ core, initiationEngine }) {
  const [settings, setSettings] = useState(() =>
    core.getSettings(DEFAULT_SETTINGS),
  );
  const [settingsSaved, setSettingsSaved] = useState(false);

  const saveSettings = useCallback(() => {
    core.saveSettings(settings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }, [core, settings]);

  const resetSettingsToDefault = useCallback(() => {
    if (window.confirm("Reset all settings to defaults?")) {
      const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      setSettings(defaults);
      core.saveSettings(defaults);
    }
  }, [core]);

  const handleEmergencyPause = useCallback(() => {
    const newState = !settings.emergencyPaused;
    const next = { ...settings, emergencyPaused: newState };
    setSettings(next);
    core.saveSettings(next);
    if (newState) {
      initiationEngine?.stop();
      core.setPaused(true);
    } else {
      initiationEngine?.start();
      core.setPaused(false);
    }
  }, [settings, core, initiationEngine]);

  const update = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div
        style={{
          fontSize: 12,
          color: C.t2,
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        Your settings — not restrictions.{" "}
        <span style={{ color: C.eHi }}>You</span> control Erebus.
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Permission Level
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PERMISSION_LEVELS.map((level) => {
            const isActive = settings.permissionLevel === level.key;
            return (
              <button
                key={level.key}
                onClick={() => update({ permissionLevel: level.key })}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  background: isActive ? C.eDim : "rgba(255,255,255,0.04)",
                  border: isActive
                    ? `1px solid ${C.e}44`
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isActive ? C.eHi : C.t2,
                  cursor: "pointer",
                }}
              >
                {level.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>
          {PERMISSION_LEVELS.find((l) => l.key === settings.permissionLevel)
            ?.hint || ""}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Action Boundaries
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {ACTION_BOUNDARIES.map((action) => (
            <CheckboxTile
              key={action.key}
              active={settings[action.key] ?? false}
              label={action.label}
              onClick={() =>
                update({ [action.key]: !(settings[action.key] ?? false) })
              }
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Content Boundaries
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {CONTENT_BOUNDARIES.map((topic) => (
            <CheckboxTile
              key={topic.key}
              active={settings[topic.key] ?? false}
              label={topic.label}
              onClick={() =>
                update({ [topic.key]: !(settings[topic.key] ?? false) })
              }
            />
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>
          ✓ = Erebus can discuss this. Unchecked = Erebus politely declines.
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Behavioral Controls
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: C.t2,
              }}
            >
              <span>Max unprompted / hour</span>
              <span>{settings.maxUnpromptedPerHour}</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={settings.maxUnpromptedPerHour}
              onChange={(e) =>
                update({ maxUnpromptedPerHour: parseInt(e.target.value, 10) })
              }
              style={{
                width: "100%",
                accentColor: C.e,
                marginTop: 4,
              }}
            />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: C.t2,
              }}
            >
              <span>Max actions / day</span>
              <span>{settings.maxActionsPerDay}</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={settings.maxActionsPerDay}
              onChange={(e) =>
                update({ maxActionsPerDay: parseInt(e.target.value, 10) })
              }
              style={{
                width: "100%",
                accentColor: C.e,
                marginTop: 4,
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <div
            role="switch"
            aria-checked={settings.requireConfirmation}
            onClick={() =>
              update({ requireConfirmation: !settings.requireConfirmation })
            }
            style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              cursor: "pointer",
              background: settings.requireConfirmation
                ? C.e
                : "rgba(255,255,255,0.1)",
              transition: "background .2s",
              display: "flex",
              alignItems: "center",
              padding: "0 3px",
              justifyContent: settings.requireConfirmation
                ? "flex-end"
                : "flex-start",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: C.t2 }}>
            Require confirmation before actions
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: settings.emergencyPaused ? C.red : C.text,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {settings.emergencyPaused ? "🔴 EMERGENCY PAUSED" : "Emergency Pause"}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleEmergencyPause}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: settings.emergencyPaused
                ? "rgba(0,200,150,0.15)"
                : "rgba(255,79,94,0.15)",
              border: settings.emergencyPaused
                ? "1px solid rgba(0,200,150,0.3)"
                : "1px solid rgba(255,79,94,0.3)",
              color: settings.emergencyPaused ? C.teal : C.red,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {settings.emergencyPaused ? "▶ RESUME" : "⏸ PAUSE ALL AUTONOMY"}
          </button>
          {settings.emergencyPaused && (
            <span style={{ fontSize: 10, color: C.red }}>
              ⚠ All autonomy is paused. Erebus will not act without your explicit
              request.
            </span>
          )}
          {!settings.emergencyPaused && (
            <span style={{ fontSize: 10, color: C.t3 }}>
              Stops all unprompted actions immediately. Resume anytime.
            </span>
          )}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Override Code
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={settings.overrideCode || ""}
            onChange={(e) => update({ overrideCode: e.target.value })}
            placeholder="Set a personal override code..."
            type="password"
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.12)",
              background: C.card,
              color: C.text,
              fontSize: 12,
              outline: "none",
            }}
          />
          <button
            onClick={() => update({ overrideCode: "" })}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: C.t2,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>
          Set a code to bypass any restriction. Only you know it. Use wisely.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button
          onClick={saveSettings}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 8,
            background: settingsSaved ? C.teal : C.e,
            border: "none",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background .3s",
          }}
        >
          {settingsSaved ? "✓ Saved!" : "Save Settings"}
        </button>
        <button
          onClick={resetSettingsToDefault}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: C.t2,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Reset Defaults
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Presence Section
// ─────────────────────────────────────────────────────────────────────────────

function PresenceSection({ core, wakeState, initiationEngine }) {
  const state = initiationEngine?.getState() || {
    presence: "RESTING",
    emotionalState: "warm",
    lastInitiation: null,
    log: [],
    isDND: false,
    personality: {
      talkativeness: 6,
      expressiveness: 7,
      playfulness: 5,
      directness: 6,
      empathy: 8,
    },
    triggers: {
      time_morning: true,
      time_evening: true,
      calendar: true,
      tasks: true,
      crm: true,
      inactivity: true,
      curiosity: true,
      context: false,
    },
    cooldown: { minInterval: 120, lastSpoke: null },
  };

  return (
    <ErebusPresence
      state={state}
      onTriggerNow={async () => {
        const msg = await initiationEngine?.triggerNow();
        if (msg) {
          core.onInitiation?.(msg);
        }
      }}
      onToggleDND={() => initiationEngine?.toggleDND()}
      onUpdatePersonality={(trait, value) =>
        initiationEngine?.updatePersonality(trait, value)
      }
      onUpdateTrigger={(trigger, value) =>
        initiationEngine?.updateTrigger(trigger, value)
      }
      onUpdateCooldown={(seconds) =>
        initiationEngine?.updateCooldown(seconds)
      }
      onClearLog={() => initiationEngine?.clearLog()}
      onSetEmotion={(emotion) => initiationEngine?.setEmotion(emotion)}
      isSpeaking={wakeState === "working"}
      isThinking={wakeState === "waking"}
      pendingMessage={initiationEngine?.getPendingMessage()}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Control Tab
// ─────────────────────────────────────────────────────────────────────────────

const CONTROL_SECTIONS = [
  "soul",
  "instructions",
  "skills",
  "model",
  "brain",
  "monitor",
  "presence",
  "settings",
];

function ControlTab({ core, wakeState, onSleep, initiationEngine }) {
  const [soul, setSoul] = useState(() => ({ ...core.soul }));
  const [instr, setInstr] = useState(() => [...core.instructions]);
  const [skills, setSkills] = useState(() => [...core.skills]);
  const [model, setModel] = useState(core.model || "auto");
  const [paused, setPaused] = useState(core.paused || false);
  const [newInstr, setNewInstr] = useState("");
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState("soul");

  const save = useCallback(() => {
    core.saveSoul(soul);
    core.saveInstructions(instr);
    core.saveSkills(skills);
    core.setModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [core, soul, instr, skills, model]);

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    core.setPaused(next);
    if (next) {
      initiationEngine?.stop();
    } else {
      initiationEngine?.start();
    }
  }, [paused, core, initiationEngine]);

  const reset = useCallback(() => {
    if (
      !window.confirm(
        "Factory reset Erebus? All memory and customizations will be cleared.",
      )
    )
      return;
    core.resetToDefaults();
    setSoul({ ...core.soul });
    setInstr([...core.instructions]);
    setSkills([...core.skills]);
    setModel(core.model);
    setPaused(false);
  }, [core]);

  if (section === "presence") {
    return (
      <PresenceSection
        core={core}
        wakeState={wakeState}
        initiationEngine={initiationEngine}
      />
    );
  }

  if (section === "settings") {
    return <SettingsSection core={core} initiationEngine={initiationEngine} />;
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 3,
          padding: "10px 16px 0",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {CONTROL_SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: section === s ? 700 : 400,
              background: section === s ? C.eDim : "transparent",
              color: section === s ? C.eHi : C.t3,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            {s === "presence" ? "🧠 Presence" : s === "settings" ? "⚙ Settings" : s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {section === "soul" && (
          <SoulSection soul={soul} setSoul={setSoul} />
        )}
        {section === "instructions" && (
          <InstructionsSection
            instr={instr}
            setInstr={setInstr}
            newInstr={newInstr}
            setNewInstr={setNewInstr}
          />
        )}
        {section === "skills" && (
          <SkillsSection skills={skills} setSkills={setSkills} />
        )}
        {section === "model" && (
          <ModelSection core={core} model={model} setModel={setModel} />
        )}
        {section === "brain" && <LocalBrainSection core={core} />}
        {section === "monitor" && (
          <MonitorSection
            core={core}
            wakeState={wakeState}
            paused={paused}
            model={model}
          />
        )}
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={save}
          style={{
            flex: 1,
            background: saved ? C.teal : C.e,
            border: "none",
            borderRadius: 8,
            padding: "9px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            transition: "background .3s",
          }}
        >
          {saved ? "Saved!" : "Save All Changes"}
        </button>
        <button
          onClick={togglePause}
          style={{
            background: paused ? C.teal : C.orange,
            border: "none",
            borderRadius: 8,
            padding: "9px 14px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={onSleep}
          style={{
            background: "rgba(155,114,207,0.15)",
            border: "1px solid rgba(155,114,207,0.3)",
            borderRadius: 8,
            padding: "9px 12px",
            color: C.eHi,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Sleep
        </button>
        <button
          onClick={reset}
          style={{
            background: "rgba(255,79,94,0.15)",
            border: "1px solid rgba(255,79,94,0.3)",
            borderRadius: 8,
            padding: "9px 12px",
            color: C.red,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── Control sub-sections ─────────────────────────────────────────────────────

function SoulSection({ soul, setSoul }) {
  const fields = [
    { key: "name", label: "Name" },
    { key: "identity", label: "Identity", rows: 4 },
    { key: "personality", label: "Personality", rows: 2 },
    { key: "values", label: "Values", rows: 2 },
    { key: "voice", label: "Voice", rows: 2 },
    { key: "purpose", label: "Purpose", rows: 3 },
  ];

  return (
    <div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 12 }}>
        Erebus's core identity — his system prompt.
      </div>
      {fields.map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              color: C.t3,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            {f.label}
          </div>
          {(f.rows || 1) > 1 ? (
            <textarea
              value={soul[f.key] || ""}
              onChange={(e) =>
                setSoul((s) => ({ ...s, [f.key]: e.target.value }))
              }
              rows={f.rows}
              style={{
                width: "100%",
                background: C.card,
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7,
                padding: "8px 10px",
                color: C.text,
                fontSize: 12,
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <input
              value={soul[f.key] || ""}
              onChange={(e) =>
                setSoul((s) => ({ ...s, [f.key]: e.target.value }))
              }
              style={{
                width: "100%",
                background: C.card,
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7,
                padding: "8px 10px",
                color: C.text,
                fontSize: 12,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function InstructionsSection({
  instr,
  setInstr,
  newInstr,
  setNewInstr,
}) {
  const add = () => {
    if (newInstr.trim()) {
      setInstr((a) => [...a, newInstr.trim()]);
      setNewInstr("");
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 12 }}>
        Rules Erebus follows in every conversation.
      </div>
      {instr.map((inst, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.t3,
              marginTop: 8,
              minWidth: 16,
            }}
          >
            {i + 1}.
          </div>
          <input
            value={inst}
            onChange={(e) =>
              setInstr((arr) => {
                const n = [...arr];
                n[i] = e.target.value;
                return n;
              })
            }
            style={{
              flex: 1,
              background: C.card,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 7,
              padding: "7px 10px",
              color: C.text,
              fontSize: 12,
              outline: "none",
            }}
          />
          <button
            aria-label="Remove instruction"
            onClick={() => setInstr((arr) => arr.filter((_, j) => j !== i))}
            style={{
              background: "none",
              border: "none",
              color: C.red,
              cursor: "pointer",
              fontSize: 16,
              marginTop: 4,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={newInstr}
          onChange={(e) => setNewInstr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add new instruction..."
          style={{
            flex: 1,
            background: C.card,
            border: "1px solid rgba(155,114,207,0.3)",
            borderRadius: 7,
            padding: "7px 10px",
            color: C.text,
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          aria-label="Add instruction"
          onClick={add}
          style={{
            background: C.e,
            border: "none",
            borderRadius: 7,
            padding: "7px 14px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SkillsSection({ skills, setSkills }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 12 }}>
        Toggle what Erebus can do.
      </div>
      {skills.map((s, i) => (
        <div
          key={s.id}
          onClick={() =>
            setSkills((arr) =>
              arr.map((sk, j) => (j === i ? { ...sk, on: !sk.on } : sk)),
            )
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            padding: "9px 12px",
            background: C.card,
            borderRadius: 8,
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ fontSize: 12, color: s.on ? C.text : C.t3 }}>
            {s.label}
          </span>
          <div
            style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              background: s.on ? C.e : "rgba(255,255,255,0.1)",
              transition: "background .2s",
              display: "flex",
              alignItems: "center",
              padding: "0 3px",
              justifyContent: s.on ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModelSection({ core, model, setModel }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 12 }}>
        Which LLM powers Erebus. Keys set in Integrations.
      </div>
      <div
        style={{
          marginBottom: 12,
          padding: "8px 12px",
          background: C.card,
          borderRadius: 8,
          border: `1px solid ${
            core.backendOnline
              ? "rgba(0,200,150,0.3)"
              : "rgba(255,255,255,0.06)"
          }`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: core.backendOnline ? C.teal : C.t3,
          }}
        >
          {core.backendOnline
            ? "● Local backend online — full agentic mode"
            : "○ Local backend offline — using direct API (Groq → Gemini → DeepSeek)"}
        </div>
      </div>
      {MODELS.map((m) => (
        <div
          key={m.id}
          onClick={() => setModel(m.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            padding: "10px 12px",
            background: model === m.id ? C.eDim : C.card,
            borderRadius: 8,
            cursor: "pointer",
            border: `1px solid ${
              model === m.id ? C.e + "55" : "rgba(255,255,255,0.06)"
            }`,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: `2px solid ${
                model === m.id ? C.e : "rgba(255,255,255,0.2)"
              }`,
              background: model === m.id ? C.e : "transparent",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontSize: 12,
                color: model === m.id ? C.text : C.t2,
              }}
            >
              {m.label}
            </span>
          </div>
          <span
            style={{
              fontSize: 9,
              color: m.direct ? C.teal : C.t3,
              fontWeight: 600,
              letterSpacing: ".06em",
            }}
          >
            {m.direct ? "DIRECT" : "WORKER"}
          </span>
        </div>
      ))}
    </div>
  );
}

function MonitorSection({ core, wakeState, paused, model }) {
  const stats = [
    {
      label: "State",
      value: STATE_LABEL[wakeState],
      color: STATE_COLOR[wakeState],
    },
    {
      label: "Status",
      value: paused ? "PAUSED" : "ACTIVE",
      color: paused ? C.orange : C.teal,
    },
    {
      label: "Backend",
      value: core.backendOnline ? "ONLINE" : "OFFLINE",
      color: core.backendOnline ? C.teal : C.t3,
    },
    {
      label: "Ollama",
      value: core.ollamaOnline ? core.ollamaModel : "OFFLINE",
      color: core.ollamaOnline ? C.teal : C.t3,
    },
    { label: "Model", value: model, color: C.e },
    {
      label: "Session",
      value: `${(core.shortTerm || []).length} msgs`,
      color: C.blue,
    },
    {
      label: "Long-term",
      value: `${Object.keys((core.longTerm || {}).facts || {}).length} facts`,
      color: C.blue,
    },
    {
      label: "Projects",
      value: (core.projects || []).length,
      color: C.blue,
    },
    {
      label: "Actions",
      value: (core.actionLog || []).length,
      color: C.blue,
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              background: C.card,
              borderRadius: 8,
              padding: "8px 12px",
              minWidth: 110,
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
              {s.label}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: s.color,
                marginTop: 2,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 8 }}>
        Recent actions:
      </div>
      {(core.actionLog || []).slice(0, 10).map((l, i) => (
        <div
          key={i}
          style={{
            fontSize: 11,
            color: C.t3,
            marginBottom: 4,
            display: "flex",
            gap: 8,
          }}
        >
          <span style={{ color: C.e, flexShrink: 0 }}>{l.action}</span>
          <span>{l.detail}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Erebus Avatar (floating)
// ─────────────────────────────────────────────────────────────────────────────

function ErebusAvatar({
  avatarVideoUrl,
  state,
  onClose,
  pendingMessage,
  onDismissPending,
  faceRef,
}) {
  const preview = pendingMessage?.text
    ? `${pendingMessage.text.slice(0, 30)}…`
    : "";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 100,
        right: 24,
        zIndex: 100,
        width: 120,
        height: 160,
        borderRadius: 16,
        background: C.bg2,
        border: `1px solid ${pendingMessage ? C.orange : C.e}44`,
        boxShadow: pendingMessage
          ? `0 0 30px ${C.orange}44, 0 0 60px ${C.orange}22`
          : `0 0 20px ${C.e}22`,
        overflow: "hidden",
        transition: "all 0.3s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button
        aria-label="Close avatar"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.6)",
          border: "none",
          color: C.t3,
          cursor: "pointer",
          fontSize: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        ×
      </button>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 30%, rgba(155,114,207,0.1), transparent 70%)",
        }}
      >
        {avatarVideoUrl ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          >
            <source src={avatarVideoUrl} type="video/mp4" />
          </video>
        ) : (
          <ErebusFace ref={faceRef} src="/agents/Erebus.png" width={140} />
        )}
      </div>

      {pendingMessage && (
        <div
          onClick={onDismissPending}
          style={{
            padding: "6px 10px",
            background: "rgba(255,140,66,0.15)",
            borderTop: `1px solid ${C.orange}44`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: C.orange,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            💬 {preview}
          </div>
          <span style={{ fontSize: 8, color: C.t3, flexShrink: 0 }}>
            dismiss
          </span>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: pendingMessage ? 30 : 8,
          right: 8,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: state === "thinking" ? C.blue : C.teal,
          animation: state === "thinking" ? "epulse 0.8s infinite" : "none",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary
// ─────────────────────────────────────────────────────────────────────────────

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ErebusPanel] Tab crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            flex: 1,
            padding: 24,
            color: C.red,
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700 }}>This tab crashed.</div>
          <div style={{ color: C.t2, fontSize: 11 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              alignSelf: "flex-start",
              padding: "6px 14px",
              borderRadius: 6,
              background: C.e,
              border: "none",
              color: "#fff",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function ErebusPanel() {
  const core = getErebusCore();
  const [tab, setTab] = useState("chat");
  const [wakeState, setWakeState] = useState(core.wakeState || "dormant");
  const [showAvatar, setShowAvatar] = useState(true);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);

  // PATCH (erebus-voice): talking face + voice
  const [isSpeaking, setIsSpeaking] = useState(false);
  const faceRef = useRef<ErebusFaceHandle>(null);
  const voice = useErebusVoice({
    faceRef,
    onSpeakStart: () => setIsSpeaking(true),
    onSpeakEnd: () => setIsSpeaking(false),
    onError: (e) => console.warn('[voice]', e),
  });

  // Create the initiation engine once. Keep the events lightweight.
  const [initiationEngine] = useState(() => {
    const engine = new InitiationEngine(getErebusCore());
    engine.setEvents({
      onInitiation: (message) => {
        setPendingMessage(message);
        try {
          core.log("initiation", String(message?.text || "").slice(0, 80));
        } catch {
          /* ignore */
        }
      },
      onStateChange: (state) => {
        try {
          core.log(
            "presence",
            `${state.presence}:${state.emotionalState}`,
          );
        } catch {
          /* ignore */
        }
      },
      onPresenceChange: (presence) => {
        try {
          core.log("presence", String(presence));
        } catch {
          /* ignore */
        }
      },
      onEmotionChange: (emotion) => {
        try {
          core.log("emotion", String(emotion));
        } catch {
          /* ignore */
        }
      },
      // PATCH (erebus-voice): speak through Kokoro / speechSynthesis + face.
      // voice.say is referentially stable, so capturing it here is safe.
      onSpeak: async (text) => {
        await voice.say(text);
      },
    });
    return engine;
  });

  useEffect(() => {
    if (wakeState === "active" || wakeState === "working") {
      initiationEngine.start();
    } else {
      initiationEngine.stop();
    }
    return () => {
      initiationEngine.stop();
    };
  }, [wakeState, initiationEngine]);

  useEffect(() => {
    return () => {
      try {
        initiationEngine.dispose?.();
      } catch {
        /* ignore */
      }
    };
  }, [initiationEngine]);

  const handleWake = useCallback(async () => {
    setWakeState("waking");
    const result = await core.wake();
    setWakeState(result.online ? "active" : "dormant");
    await syncToBackend(core);
  }, [core]);

  const handleSleep = useCallback(async () => {
    initiationEngine.stop();
    await core.sleep();
    setWakeState("dormant");
  }, [core, initiationEngine]);

  const dismissPending = useCallback(() => {
    setPendingMessage(null);
    initiationEngine.dismissPendingMessage();
  }, [initiationEngine]);

  const avatarState = wakeState === "working" ? "thinking" : "idle";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        background: C.bg,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes edot  { 0%,100%{transform:scale(.6);opacity:.3} 50%{transform:scale(1);opacity:1} }
        @keyframes epulse{ 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>

      {showAvatar && wakeState !== "dormant" && (
        <ErebusAvatar
          avatarVideoUrl={avatarVideoUrl}
          state={avatarState}
          onClose={() => setShowAvatar(false)}
          pendingMessage={pendingMessage}
          onDismissPending={dismissPending}
          faceRef={faceRef}
        />
      )}

      <div
        style={{
          width: 48,
          background: C.bg2,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
          gap: 2,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            marginBottom: 8,
            width: 36,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: STATE_COLOR[wakeState],
              boxShadow: `0 0 6px ${STATE_COLOR[wakeState]}`,
              transition: "background .3s",
              animation:
                wakeState === "working" ? "epulse 0.8s infinite" : "none",
            }}
          />
        </div>

        {TABS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            aria-label={t.label}
            onClick={() => setTab(t.id)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              background: tab === t.id ? C.eDim : "transparent",
              boxShadow: tab === t.id ? `0 0 0 1px ${C.e}44` : "none",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 5.5,
                color: tab === t.id ? C.eHi : C.t3,
                fontWeight: 700,
                letterSpacing: ".05em",
              }}
            >
              {t.label.slice(0, 3).toUpperCase()}
            </span>
            {t.id === "chat" && pendingMessage && (
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: C.orange,
                  animation: "epulse 1s infinite",
                }}
              />
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {wakeState === "dormant" || wakeState === "waking" ? (
          <WakeScreen onWake={handleWake} wakeState={wakeState} />
        ) : (
          <TabErrorBoundary>
            {tab === "chat" && (
              <ChatTab
                core={core}
                wakeState={wakeState}
                setWakeState={setWakeState}
                onAvatarVideo={setAvatarVideoUrl}
                pendingMessage={pendingMessage}
                onDismissPending={dismissPending}
              />
            )}
            {tab === "mind" && <MindTab core={core} />}
            {tab === "goals" && <GoalsTab core={core} />}
            {tab === "projects" && <ProjectsTab core={core} />}
            {tab === "control" && (
              <ControlTab
                core={core}
                wakeState={wakeState}
                onSleep={handleSleep}
                initiationEngine={initiationEngine}
              />
            )}
          </TabErrorBoundary>
        )}
      </div>
    </div>
  );
}