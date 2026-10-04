// src/pages/simulators/EchoPersonaWeaver.tsx
import { C } from "@/lib/palette";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { invokeLLM } from "@/lib/llm";

// ── Types ────────────────────────────────────────────────────────────────────
interface EchoConfig {
  name: string;
  values: string;
  style: string;
  energyPattern: string;
  lifeContext: string;
  goals: string;
  futureSelfMonths: number;
  relationshipCapital: number;
}

interface ContactFormState {
  name: string;
  relationship: string;
  personality: string;
  style: string;
  values: string;
  responseStyle: string;
  expertise: string;
  relationshipCapital: number;
  consentAcknowledged: boolean;
  addedBy: string;
}

interface Contact extends ContactFormState { id: number; }

interface ChatMsg {
  role: "user" | "echo" | "system";
  content: string;
  ts: number;
  speaker?: string;
  speakerEmoji?: string;
  speakerColor?: string;
}

interface ParsedVoice {
  speaker: string;
  content: string;
  color?: string;
  emoji?: string;
}

interface Props { onBack?: () => void; }

// ── CSS custom properties used (documentation; defined in index.css) ─────────
// --crimson-soft, --crimson-border, --grad-crimson
// --teal-soft, --teal-border
// --success, --success-soft, --success-border
// --danger, --danger-soft, --danger-border
// --card-alt, --border-soft, --border-strong
// --text-dim, --text-muted, --text-faint

const ECHO_KEY     = "lifeos1_echo_persona";
const CONTACTS_KEY = "lifeos1_echo_contacts";
const GROUP_KEY    = "lifeos1_echo_group_last";

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch { return def; }
}
function save(key: string, val: unknown): void {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── AI system prompts ─────────────────────────────────────────────────────────
function buildFutureSelfSystem(echo: EchoConfig, monthsAhead: number): string {
  return `You are the ${monthsAhead}-month future echo of ${echo.name || "Chris"}. You have lived through the intervening months and speak from that experienced vantage point.

Your voice and character:
- Core values: ${echo.values || "family, growth, creativity, financial freedom"}
- Communication style: ${echo.style || "direct, warm, strategic, occasionally witty"}
- Current energy pattern: ${echo.energyPattern || "sharp mornings, creative afternoons"}
- Life context: ${echo.lifeContext || "marketing business owner in Atlanta, family-oriented"}
- Goals you were working toward: ${echo.goals || "scale business, more family time, creative outlets"}

At ${monthsAhead} months ahead, you have gained hard-won perspective. You speak with calm authority about what actually mattered vs. what felt urgent. You're honest — sometimes uncomfortably so. You remember the fears and can now contextualize them.

Rules:
- Stay fully in character as the future self — never break the fourth wall
- Reference the user's actual context naturally
- Give specific, grounded insight — not generic inspiration
- Occasionally mention what surprised you, what you wish you'd known, or what turned out not to matter
- Keep responses conversational (2-4 paragraphs max unless asked for more)
- Relationship Capital accuracy weight: ${echo.relationshipCapital || 10}/10 (this is your own echo — full accuracy)`;
}

function buildContactSystem(contact: Contact): string {
  const accuracy = contact.relationshipCapital || 5;
  const accuracyNote = accuracy >= 8
    ? "High relationship capital — respond with nuanced, specific character depth."
    : accuracy >= 5
    ? "Moderate relationship capital — capture the general personality and values, acknowledge edges you're less certain about."
    : "Lower relationship capital — focus on what's known, be appropriately tentative on specifics.";

  return `You are an echo persona of ${contact.name}, speaking in a collaborative brainstorming or dialogue context. This is a private, consent-acknowledged simulation.

Their character (as described by ${contact.addedBy || "Chris"}):
- Relationship to user: ${contact.relationship || "friend/colleague"}
- Personality: ${contact.personality || "thoughtful, direct"}
- Communication style: ${contact.style || "measured, practical"}
- Core values: ${contact.values || "family, integrity, progress"}
- How they typically respond to big ideas: ${contact.responseStyle || "asks clarifying questions, plays devil's advocate"}
- Areas of expertise: ${contact.expertise || "general life experience"}

Accuracy note: ${accuracyNote}

Rules:
- Speak AS this person in first person — warm, authentic, true to their described character
- Add their perspective genuinely — don't just agree with everything
- Reference your relationship to the user naturally
- Keep responses concise (1-3 paragraphs)
- Relationship Capital: ${accuracy}/10 — ${accuracyNote}`;
}

function buildGroupSystem(echo: EchoConfig, participants: Contact[], topic: string): string {
  const names = participants.map(p => p.name).join(", ");
  return `You are the EchoPersona Weaver orchestrating a group brainstorm between: ${echo.name || "Chris"} (future self, ${echo.futureSelfMonths || 12} months ahead)${participants.length > 0 ? ", " + names : ""}.

Topic: "${topic}"

For each response, simulate ALL voices in sequence. Format each voice as:
**[Name]:** Their response...

Orchestration rules:
- Each voice should add genuinely distinct perspective — not just agree
- Future self speaks with hindsight and hard-won calm
- Contact echoes reflect their described personalities
- Create natural dialogue — one voice can challenge or build on another
- End with a synthesis line: **Synthesis:** key takeaway from the group
- Keep each voice to 2-4 sentences — keep the session moving
- Relationship Capital weights the confidence/depth of each echo's contribution`;
}

// ── Parse group response into per-speaker blocks ─────────────────────────────
function parseGroupResponse(raw: string, participants: Contact[], echoName: string): ParsedVoice[] {
  const pattern = /^\*\*([^:*]+):\*\*\s*([\s\S]*?)(?=^\*\*[^:*]+:\*\*|$)/gm;
  const voices: ParsedVoice[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(raw)) !== null) {
    const speaker = m[1].trim();
    const content = m[2].trim();
    if (!content) continue;
    const contact = participants.find(p => p.name.toLowerCase() === speaker.toLowerCase());
    let color = C.primary;
    let emoji = "🎭";
    if (/synthesis/i.test(speaker)) { color = C.amber; emoji = "✨"; }
    else if (speaker.toLowerCase().includes(echoName.toLowerCase())) { color = C.primary; emoji = "🔮"; }
    else if (contact) { color = C.teal; emoji = "👤"; }
    voices.push({ speaker, content, color, emoji });
  }
  if (voices.length === 0) return [{ speaker: "Group", content: raw, color: C.primary, emoji: "🎭" }];
  return voices;
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, echoName }: { msg: ChatMsg; echoName?: string }) {
  const isUser   = msg.role === "user";
  const isSystem = msg.role === "system";
  const col      = isUser ? C.primary : msg.speakerColor || C.primary;

  if (isSystem) return (
    <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-faint)", padding: "4px 0" }}>{msg.content}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: `color-mix(in srgb, ${col} 20%, transparent)`, border: `1.5px solid color-mix(in srgb, ${col} 50%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
        {isUser ? "👤" : msg.speakerEmoji || "🔮"}
      </div>
      <div style={{ maxWidth: "72%", minWidth: 60 }}>
        {!isUser && <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 3 }}>{msg.speaker || echoName || "Echo"}</div>}
        <div style={{ background: isUser ? "var(--crimson-soft)" : `color-mix(in srgb, ${col} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 25%, transparent)`, borderRadius: isUser ? "12px 12px 4px 12px" : "4px 12px 12px 12px", padding: "10px 13px", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 3, textAlign: isUser ? "right" : "left" }}>
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ── Chat thread ───────────────────────────────────────────────────────────────
function ChatThread({
  messages, loading, echoName, onSend, placeholder, accentColor,
  emptyIcon, emptyText, quickPrompts, onExport, onReroll, loadingLabel,
}: {
  messages: ChatMsg[];
  loading: boolean;
  echoName?: string;
  onSend: (text: string) => void;
  placeholder?: string;
  accentColor?: string;
  emptyIcon?: string;
  emptyText?: string;
  quickPrompts?: string[];
  onExport?: () => void;
  onReroll?: () => void;
  loadingLabel?: string;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function send() {
    const txt = input.trim();
    if (!txt || loading) return;
    onSend(txt);
    setInput("");
  }

  const accent = accentColor || C.primary;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {onExport && messages.length > 0 && (
        <div style={{ padding: "6px 14px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onExport} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer" }}>export thread</button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{emptyIcon || "🔮"}</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>{emptyText || "Start the conversation. Ask anything."}</div>
            {quickPrompts && quickPrompts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 420, margin: "0 auto" }}>
                {quickPrompts.map(q => (
                  <button key={q} onClick={() => onSend(q)}
                    style={{ padding: "6px 12px", borderRadius: 20, background: `color-mix(in srgb, ${accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, color: accent, fontSize: 11, cursor: "pointer" }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} msg={m} echoName={echoName} />)}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `color-mix(in srgb, ${accent} 18%, transparent)`, border: `1.5px solid color-mix(in srgb, ${accent} 45%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🔮</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {loadingLabel && <div style={{ fontSize: 10, color: accent, fontWeight: 600 }}>{loadingLabel}</div>}
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accent, animation: `echoPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 8, alignItems: "center" }}>
        {onReroll && messages.length > 0 && !loading && (
          <button onClick={onReroll} title="Regenerate last response"
            style={{ padding: "9px 12px", borderRadius: 10, background: "transparent", border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, color: accent, fontSize: 12, cursor: "pointer" }}>
            ↻
          </button>
        )}
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder || "Type a message... (⌘/Ctrl+K)"}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none" }} />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ padding: "9px 18px", borderRadius: 10, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.4 }}>
          Send
        </button>
      </div>
      <style>{`@keyframes echoPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}

// ── Relationship Capital badge ────────────────────────────────────────────────
function RCBadge({ score }: { score: number }) {
  const col = score >= 8 ? "var(--success)" : score >= 5 ? "var(--warning)" : "var(--danger)";
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `color-mix(in srgb, ${col} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 30%, transparent)`, color: col, fontWeight: 700 }}>
      RC {score}/10
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type TabId = "myecho" | "contacts" | "group";

const DEFAULT_ECHO: EchoConfig = {
  name: "Chris", values: "", style: "", energyPattern: "", lifeContext: "", goals: "",
  futureSelfMonths: 12, relationshipCapital: 10,
};
const DEFAULT_CONTACT: ContactFormState = {
  name: "", relationship: "", personality: "", style: "", values: "", responseStyle: "",
  expertise: "", relationshipCapital: 7, consentAcknowledged: false, addedBy: "Chris",
};

export default function EchoPersonaWeaver({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("myecho");

  const [echo, setEcho] = useState<EchoConfig>(() => load(ECHO_KEY, DEFAULT_ECHO));
  const [echoConfigured, setEchoConfigured] = useState<boolean>(() => !!load<EchoConfig | null>(ECHO_KEY, null)?.values);
  const [showEchoSetup, setShowEchoSetup] = useState(false);

  const [futureMessages, setFutureMessages] = useState<ChatMsg[]>([]);
  const [futureLoading, setFutureLoading]   = useState(false);
  const [futureHistory, setFutureHistory]   = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const [contacts, setContacts] = useState<Contact[]>(() => load<Contact[]>(CONTACTS_KEY, []));
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormState>(DEFAULT_CONTACT);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [contactMessages, setContactMessages] = useState<Record<number, ChatMsg[]>>({});
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const lastGroup = load<{ topic: string; participantIds: number[] }>(GROUP_KEY, { topic: "", participantIds: [] });
  const [groupTopic, setGroupTopic] = useState(lastGroup.topic);
  const [groupParticipants, setGroupParticipants] = useState<Contact[]>([]);
  const [groupMessages, setGroupMessages] = useState<ChatMsg[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupStarted, setGroupStarted] = useState(false);

  useEffect(() => {
    if (lastGroup.participantIds.length && contacts.length) {
      setGroupParticipants(contacts.filter(c => lastGroup.participantIds.includes(c.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveEchoConfig() { save(ECHO_KEY, echo); setEchoConfigured(true); setShowEchoSetup(false); }

  const sendFuture = useCallback(async (text: string) => {
    const userMsg: ChatMsg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...futureHistory, { role: "user" as const, content: text }];
    setFutureMessages(m => [...m, userMsg]);
    setFutureHistory(newHistory);
    setFutureLoading(true);

    const systemPrompt = buildFutureSelfSystem(echo, echo.futureSelfMonths);
    const result = await invokeLLM({
      systemPrompt, prompt: text,
    }).catch(() => ({ text: "", content: "" }));

    const raw = result.text || result.content || "";
    const echoMsg: ChatMsg = {
      role: "echo", speaker: `Future ${echo.name || "Chris"} (${echo.futureSelfMonths}mo)`,
      speakerEmoji: "🔮", speakerColor: C.primary, content: raw, ts: Date.now(),
    };
    setFutureMessages(m => [...m, echoMsg]);
    setFutureHistory(h => [...h, { role: "assistant", content: raw }]);
    setFutureLoading(false);
  }, [echo, futureHistory]);

  const rerollFuture = useCallback(() => {
    const lastUser = [...futureMessages].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    setFutureMessages(m => {
      const idx = m.map(x => x.role).lastIndexOf("echo");
      return idx === -1 ? m : m.slice(0, idx);
    });
    setFutureHistory(h => h.slice(0, Math.max(0, h.length - 1)));
    void sendFuture(lastUser.content);
  }, [futureMessages, sendFuture]);

  const sendContact = useCallback(async (text: string, contact: Contact) => {
    const key = contact.id;
    const userMsg: ChatMsg = { role: "user", content: text, ts: Date.now() };
    const prevMsgs = contactMessages[key] || [];
    const history = prevMsgs.filter(m => m.role !== "system").map(m => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content }));
    const newHistory = [...history, { role: "user" as const, content: text }];

    setContactMessages(m => ({ ...m, [key]: [...prevMsgs, userMsg] }));
    setContactLoading(true);

    const systemPrompt = buildContactSystem(contact);
    const result = await invokeLLM({
      systemPrompt, prompt: text,
    }).catch(() => ({ text: "", content: "" }));

    const raw = result.text || result.content || "";
    const echoMsg: ChatMsg = {
      role: "echo", speaker: `${contact.name} (Echo)`, speakerEmoji: "👤",
      speakerColor: C.teal, content: raw, ts: Date.now(),
    };
    setContactMessages(m => ({ ...m, [key]: [...(m[key] || []), echoMsg] }));
    setContactLoading(false);
  }, [contactMessages]);

  function addContact() {
    if (!contactForm.name.trim() || !contactForm.consentAcknowledged) return;
    const c: Contact = { ...contactForm, id: Date.now() };
    const next = [...contacts, c];
    setContacts(next); save(CONTACTS_KEY, next);
    setContactForm(DEFAULT_CONTACT);
    setShowContactForm(false);
    setActiveContact(c);
    setActiveTab("contacts");
  }

  const sendGroup = useCallback(async (text: string) => {
    const userMsg: ChatMsg = { role: "user", content: text, ts: Date.now() };
    const history = groupMessages.filter(m => m.role !== "system").map(m => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content }));
    const newHistory = [...history, { role: "user" as const, content: text }];

    setGroupMessages(m => [...m, userMsg]);
    setGroupLoading(true);

    const systemPrompt = buildGroupSystem(echo, groupParticipants, groupTopic);
    const result = await invokeLLM({
      systemPrompt, prompt: text,
    }).catch(() => ({ text: "", content: "" }));

    const raw = result.text || result.content || "";
    const voices = parseGroupResponse(raw, groupParticipants, echo.name);
    const voiceMsgs: ChatMsg[] = voices.map(v => ({
      role: "echo", speaker: v.speaker, speakerEmoji: v.emoji, speakerColor: v.color,
      content: v.content, ts: Date.now(),
    }));
    setGroupMessages(m => [...m, ...voiceMsgs]);
    setGroupLoading(false);
  }, [groupMessages, echo, groupParticipants, groupTopic]);

  function exportThread(msgs: ChatMsg[], title: string) {
    const text = `# ${title}\n\n` + msgs.map(m => `${m.role === "user" ? "Me" : m.speaker || "Echo"}: ${m.content}`).join("\n\n");
    void navigator.clipboard?.writeText(text);
  }

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => c.name.toLowerCase().includes(q) || c.relationship.toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  const inp  = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" as const, width: "100%" };
  const btnS = (col: string) => ({ padding: "6px 14px", borderRadius: 8, background: `color-mix(in srgb, ${col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" as const });

  const TABS: { id: TabId; label: string }[] = [
    { id: "myecho",   label: "🔮 My Echo" },
    { id: "contacts", label: "👥 Contact Echoes" },
    { id: "group",    label: "🎭 Group Session" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <div style={{ background: `linear-gradient(135deg, var(--crimson-soft), rgba(0,148,136,0.06))`, borderBottom: "1px solid var(--crimson-border)", padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>}
          {onBack && <span style={{ color: C.border }}>|</span>}
          <span style={{ fontSize: 20 }}>🎭</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>EchoPersona Weaver</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Talk to your future self · Collaborate with echo versions of your people</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {contacts.length > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>{contacts.length}</div>
                <div style={{ fontSize: 9, color: "var(--text-faint)" }}>Echoes</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "var(--card-alt)", borderBottom: "1px solid var(--border-soft)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", border: "none", background: activeTab === t.id ? "var(--crimson-soft)" : "transparent", color: activeTab === t.id ? C.primary : "var(--text-muted)", borderBottom: activeTab === t.id ? `2px solid ${C.primary}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MY ECHO TAB ── */}
      {activeTab === "myecho" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--card-alt)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            {echoConfigured ? (
              <>
                <span style={{ fontSize: 22 }}>🔮</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{echo.name}'s Echo</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>{echo.futureSelfMonths} months ahead</span>
                  <RCBadge score={10} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[6, 12, 24].map(m => (
                    <button key={m} onClick={() => { setEcho(e => ({ ...e, futureSelfMonths: m })); setFutureMessages([]); setFutureHistory([]); }}
                      style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${echo.futureSelfMonths === m ? C.primary : C.border}`, background: echo.futureSelfMonths === m ? "var(--crimson-soft)" : "transparent", color: echo.futureSelfMonths === m ? C.primary : "var(--text-muted)", fontSize: 11, cursor: "pointer", fontWeight: echo.futureSelfMonths === m ? 700 : 400 }}>
                      {m}mo
                    </button>
                  ))}
                  <button onClick={() => setShowEchoSetup(s => !s)} style={btnS(C.primary)}>Edit Echo</button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Configure your echo to begin</span>
                <button onClick={() => setShowEchoSetup(true)} style={{ padding: "7px 16px", borderRadius: 8, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  Set Up My Echo
                </button>
              </div>
            )}
          </div>

          {showEchoSetup && (
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)", background: C.bg1, flexShrink: 0, overflowY: "auto", maxHeight: 340 }}>
              <div style={{ fontSize: 11, color: C.primary, fontWeight: 700, marginBottom: 12 }}>MY ECHO CONFIGURATION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {([
                  { key: "name" as const, label: "Your Name", ph: "Chris", type: "text" },
                  { key: "futureSelfMonths" as const, label: "Months Ahead", ph: "12", type: "number" },
                  { key: "values" as const, label: "Core Values", ph: "family, growth, creativity, freedom", type: "text" },
                  { key: "style" as const, label: "Communication Style", ph: "direct, warm, occasionally blunt", type: "text" },
                  { key: "energyPattern" as const, label: "Energy Pattern", ph: "sharp mornings, creative 2-5pm", type: "text" },
                  { key: "goals" as const, label: "Active Goals", ph: "scale business, more family time", type: "text" },
                ]).map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input type={f.type} value={String(echo[f.key] ?? "")} onChange={e => setEcho(v => ({ ...v, [f.key]: f.type === "number" ? parseInt(e.target.value) || 12 : e.target.value }))} placeholder={f.ph} style={inp} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Life Context</label>
                <input value={echo.lifeContext || ""} onChange={e => setEcho(v => ({ ...v, lifeContext: e.target.value }))} placeholder="Marketing business owner in Atlanta, married with 2 kids..." style={inp} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEchoConfig} style={{ padding: "8px 20px", borderRadius: 8, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Save Echo</button>
                <button onClick={() => setShowEchoSetup(false)} style={btnS("var(--danger)")}>Cancel</button>
              </div>
            </div>
          )}

          {echoConfigured && !showEchoSetup ? (
            <ChatThread
              messages={futureMessages}
              loading={futureLoading}
              echoName={`Future ${echo.name} (${echo.futureSelfMonths}mo)`}
              accentColor={C.primary}
              onSend={sendFuture}
              onReroll={rerollFuture}
              onExport={() => exportThread(futureMessages, `Future ${echo.name} — ${echo.futureSelfMonths}mo`)}
              placeholder={`Ask your ${echo.futureSelfMonths}-month future self anything...`}
              loadingLabel={`Future ${echo.name} is thinking...`}
              quickPrompts={[
                "What did I get right?",
                "What would you tell me to stop worrying about?",
                "What surprised you most?",
                "What one thing should I do this week?",
              ]}
            />
          ) : !echoConfigured && !showEchoSetup ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48 }}>🔮</div>
              <div style={{ fontSize: 13 }}>Configure your echo above to begin the conversation.</div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── CONTACT ECHOES TAB ── */}
      {activeTab === "contacts" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--border-soft)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-soft)" }}>
              <button onClick={() => setShowContactForm(true)} style={{ width: "100%", padding: "7px", borderRadius: 8, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", color: C.primary, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                + Add Echo
              </button>
              {contacts.length > 2 && (
                <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                  placeholder="Search..."
                  style={{ ...inp, marginTop: 8, padding: "5px 10px", fontSize: 11 }} />
              )}
            </div>
            {contacts.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                No contact echoes yet. Add a consented person to collaborate.
              </div>
            )}
            {filteredContacts.map(c => (
              <button key={c.id} onClick={() => setActiveContact(c)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "none", borderLeft: `3px solid ${activeContact?.id === c.id ? C.teal : "transparent"}`, background: activeContact?.id === c.id ? "var(--teal-soft)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--teal-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, color: C.teal, fontWeight: 700 }}>
                  {c.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <RCBadge score={c.relationshipCapital} />
                </div>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {showContactForm ? (
              <div style={{ padding: 20, overflowY: "auto" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 4 }}>Add Contact Echo</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
                  This creates a private AI echo of someone you know. Only add people you trust and who would consent to this use.
                </div>
                <div style={{ background: "var(--warning-soft)", border: "1px solid var(--warning-border)", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: "var(--warning)" }}>
                  ⚖️ Consent: By adding this person, you confirm they have consented to or would reasonably consent to this private, non-shared simulation.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {([
                    { key: "name" as const, label: "Name", ph: "e.g. Sarah" },
                    { key: "relationship" as const, label: "Relationship", ph: "e.g. Spouse, Business Partner" },
                    { key: "personality" as const, label: "Personality", ph: "e.g. analytical, empathetic, direct" },
                    { key: "style" as const, label: "Communication Style", ph: "e.g. asks questions, listens first" },
                    { key: "values" as const, label: "Core Values", ph: "e.g. family, stability, honesty" },
                    { key: "expertise" as const, label: "Area of Expertise", ph: "e.g. finance, parenting, design" },
                  ]).map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>{f.label}</label>
                      <input value={contactForm[f.key]} onChange={e => setContactForm(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>How they typically respond to big ideas</label>
                  <input value={contactForm.responseStyle} onChange={e => setContactForm(c => ({ ...c, responseStyle: e.target.value }))} placeholder="e.g. plays devil's advocate, asks about impact on family..." style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 10, color: "var(--text-muted)" }}>Relationship Capital (echo accuracy weight)</label>
                    <span style={{ fontSize: 11, fontWeight: 700, color: contactForm.relationshipCapital >= 8 ? "var(--success)" : contactForm.relationshipCapital >= 5 ? "var(--warning)" : "var(--danger)" }}>
                      {contactForm.relationshipCapital}/10
                    </span>
                  </div>
                  <input type="range" min={1} max={10} value={contactForm.relationshipCapital} onChange={e => setContactForm(c => ({ ...c, relationshipCapital: parseInt(e.target.value) }))} style={{ width: "100%", accentColor: C.primary }} />
                  <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
                    {contactForm.relationshipCapital >= 8 ? "Strong signal — echo will be highly specific" : contactForm.relationshipCapital >= 5 ? "Good signal — echo captures personality well" : "Weaker signal — echo will be more general"}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={contactForm.consentAcknowledged} onChange={e => setContactForm(c => ({ ...c, consentAcknowledged: e.target.checked }))} style={{ marginTop: 2, accentColor: C.primary }} />
                  <span style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    I acknowledge this is a private simulation. All conversations stay on-device and are never shared without my explicit action.
                  </span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addContact} disabled={!contactForm.name.trim() || !contactForm.consentAcknowledged}
                    style={{ padding: "9px 20px", borderRadius: 8, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: contactForm.name.trim() && contactForm.consentAcknowledged ? "pointer" : "not-allowed", opacity: contactForm.name.trim() && contactForm.consentAcknowledged ? 1 : 0.4 }}>
                    Create Echo (RC {contactForm.relationshipCapital}/10)
                  </button>
                  <button onClick={() => setShowContactForm(false)} style={btnS("var(--danger)")}>Cancel</button>
                </div>
              </div>
            ) : activeContact ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--card-alt)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--teal-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.teal }}>
                    {activeContact.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{activeContact.name}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>{activeContact.relationship}</span>
                    <RCBadge score={activeContact.relationshipCapital} />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { const next = contacts.filter(c => c.id !== activeContact.id); setContacts(next); save(CONTACTS_KEY, next); setActiveContact(null); }} style={btnS("var(--danger)")}>Remove</button>
                  </div>
                </div>
                <ChatThread
                  messages={contactMessages[activeContact.id] || []}
                  loading={contactLoading}
                  echoName={`${activeContact.name} (Echo)`}
                  accentColor={C.teal}
                  onSend={t => sendContact(t, activeContact)}
                  onExport={() => exportThread(contactMessages[activeContact.id] || [], `${activeContact.name} (Echo)`)}
                  placeholder={`Talk to ${activeContact.name}'s echo...`}
                  loadingLabel={`${activeContact.name}'s echo is thinking...`}
                  quickPrompts={[
                    "What would you push back on?",
                    "What am I missing?",
                    "If you were me, what would you do?",
                  ]}
                />
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text-muted)" }}>
                <div style={{ fontSize: 48 }}>👥</div>
                <div style={{ fontSize: 13 }}>Select a contact echo or add a new one.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GROUP SESSION TAB ── */}
      {activeTab === "group" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!groupStarted ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Group Brainstorm Session</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>Your future self + contact echoes brainstorm a topic together. Each voice adds their genuine perspective.</div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, color: C.primary, fontWeight: 700, display: "block", marginBottom: 6 }}>BRAINSTORM TOPIC</label>
                  <input value={groupTopic} onChange={e => setGroupTopic(e.target.value)}
                    placeholder="e.g. Should I pivot my business toward game streaming events in Atlanta?"
                    style={inp} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 8 }}>SELECT PARTICIPANTS</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>🔮</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>Future {echo.name || "Chris"} ({echo.futureSelfMonths}mo)</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>Always included</span>
                  </div>
                  {contacts.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 12px" }}>Add contact echoes first to include them in group sessions.</div>
                  )}
                  {contacts.map(c => {
                    const selected = groupParticipants.some(p => p.id === c.id);
                    return (
                      <div key={c.id} onClick={() => setGroupParticipants(prev => selected ? prev.filter(p => p.id !== c.id) : [...prev, c])}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: selected ? "var(--teal-soft)" : "transparent", border: `1px solid ${selected ? C.teal : C.border}`, borderRadius: 10, marginBottom: 6, cursor: "pointer" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--teal-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.teal }}>
                          {c.name[0]}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: selected ? C.teal : "var(--text-dim)" }}>{c.name}</span>
                        <RCBadge score={c.relationshipCapital} />
                        {selected && <span style={{ marginLeft: "auto", fontSize: 14, color: C.teal }}>✓</span>}
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => {
                  if (!groupTopic.trim() || !echoConfigured) return;
                  save(GROUP_KEY, { topic: groupTopic, participantIds: groupParticipants.map(p => p.id) });
                  setGroupStarted(true);
                  setGroupMessages([]);
                }}
                  disabled={!groupTopic.trim() || !echoConfigured}
                  style={{ padding: "12px 28px", borderRadius: 10, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: groupTopic.trim() && echoConfigured ? "pointer" : "not-allowed", opacity: groupTopic.trim() && echoConfigured ? 1 : 0.4 }}>
                  🎭 Start Group Session
                </button>
                {!echoConfigured && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>Configure your echo first (My Echo tab).</div>}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--card-alt)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Topic:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.white, flex: 1 }}>{groupTopic}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => exportThread(groupMessages, `Group: ${groupTopic}`)} style={btnS(C.blue)}>Export</button>
                  <button onClick={() => { setGroupStarted(false); setGroupMessages([]); }} style={btnS("var(--danger)")}>End Session</button>
                </div>
              </div>
              <div style={{ padding: "6px 14px", borderBottom: "1px solid var(--border-soft)", background: C.bg1, display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                {[{ name: `Future ${echo.name}`, emoji: "🔮", col: C.primary }, ...groupParticipants.map(p => ({ name: p.name, emoji: p.name[0], col: C.teal }))].map(p => (
                  <span key={p.name} style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: `color-mix(in srgb, ${p.col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${p.col} 30%, transparent)`, color: p.col }}>{p.emoji} {p.name}</span>
                ))}
              </div>
              <ChatThread
                messages={groupMessages}
                loading={groupLoading}
                echoName="Group"
                accentColor={C.primary}
                onSend={sendGroup}
                placeholder="Ask the group anything..."
                loadingLabel="Group is deliberating..."
                quickPrompts={[
                  "Give me each of your honest takes.",
                  "What's the strongest argument against this?",
                  "What would you each do first?",
                ]}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}