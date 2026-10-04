// src/pages/simulators/FantasyFriendSimulator.tsx
import { C } from "@/lib/palette";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { invokeLLM } from "@/lib/llm";
import { supabase } from "@/lib/supabaseClient";

// ── Types ────────────────────────────────────────────────────────────────────
interface ContactLite {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  image_upload: string | null;
  avatar_url: string | null;
  company: string | null;
  job_title: string | null;
}

interface FantasyMember {
  id: number;
  contactId: string | null;
  realName: string;
  fantasyName: string;
  title: string;
  catchphrase: string;
  origin: string;
  superpower: string;
  weakness: string;
  quirks: string[];
  humorStyle: string;
  openingLine: string;
  archetype: string;
  addedAt: string;
}

interface CreatorForm {
  contactId: string | null;
  realName: string;
  relationship: string;
  personality: string;
  humorNotes: string;
  archetype: string;
  consentAck: boolean;
}

interface PreviewData {
  fantasyName: string;
  title: string;
  catchphrase: string;
  origin: string;
  superpower: string;
  weakness: string;
  quirks: string[];
  humorStyle: string;
  openingLine: string;
}

type ChatMsgRole = "user" | "friend" | "group" | "system";
interface ChatMsg {
  role: ChatMsgRole;
  content: string;
  ts: number;
  friendId?: number | "group";
}

interface Scenario {
  icon: string;
  title: string;
  prompt: string;
}

interface Props { onBack?: () => void; }

// ── CSS custom properties used (documentation; defined in index.css) ─────────
// --crimson-soft, --crimson-border, --grad-crimson
// --teal-soft, --teal-border
// --success, --warning, --danger
// --card-alt, --border-soft, --border-strong
// --text-dim, --text-muted, --text-faint

const CREW_KEY = "lifeos1_fantasy_crew";

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch { return def; }
}
function save(key: string, val: unknown): void {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Fantasy archetypes (no per-color; emoji carries distinction) ─────────────
const ARCHETYPES: { id: string; label: string; emoji: string }[] = [
  { id: "pirate",        label: "Pirate",         emoji: "⚓" },
  { id: "wizard",        label: "Wizard",         emoji: "🧙" },
  { id: "superhero",     label: "Superhero",      emoji: "🦸" },
  { id: "rockstar",      label: "Rockstar",       emoji: "🎸" },
  { id: "chef",          label: "Chaos Chef",     emoji: "👨‍🍳" },
  { id: "scientist",     label: "Mad Scientist",  emoji: "🔬" },
  { id: "athlete",       label: "Sports Legend",  emoji: "🏆" },
  { id: "ninja",         label: "Ninja",          emoji: "🥷" },
  { id: "royalty",       label: "Royalty",        emoji: "👑" },
  { id: "time_traveler", label: "Time Traveler",  emoji: "⏳" },
  { id: "detective",     label: "Detective",      emoji: "🔍" },
  { id: "dragon",        label: "Dragon Tamer",   emoji: "🐉" },
];

function archetypeMeta(id: string) {
  return ARCHETYPES.find(a => a.id === id) ?? ARCHETYPES[0];
}

// ── Atlanta scenario starters ────────────────────────────────────────────────
const SCENARIOS: Scenario[] = [
  { icon: "💦", title: "Ultimate Water Balloon Fight",   prompt: "Plan the ultimate Atlanta water balloon fight at Piedmont Park. Assign everyone roles, create a battle strategy, and argue about the rules." },
  { icon: "🏈", title: "Falcons Super Bowl Prediction", prompt: "The Falcons are going to the Super Bowl. React in character, make wild predictions, and plan the watch party of the century in Atlanta." },
  { icon: "🍑", title: "Open an Atlanta Food Truck",    prompt: "You're all starting an Atlanta food truck together. Pick the name, the menu, the location, and the vibe. Argue hilariously about everything." },
  { icon: "🎤", title: "Karaoke Night Gone Wrong",      prompt: "It's karaoke night at a random Atlanta bar. Everyone picks the most wrong song for each other. Things escalate." },
  { icon: "🏀", title: "3-on-3 Basketball Trash Talk",  prompt: "You're all playing pickup basketball in Atlanta. Trash talk in character, claim impossible stats, and argue about who's the GOAT." },
  { icon: "🎲", title: "Wild Road Trip Debate",         prompt: "You're planning a road trip from Atlanta to Miami. Everyone wants something different. Plan the most chaotic trip imaginable." },
  { icon: "🍕", title: "Settle the Debate: Best Pizza", prompt: "Argue about the best pizza in Atlanta. Everyone has a ridiculous opinion. It somehow becomes a life-or-death philosophical debate." },
  { icon: "🌩️", title: "Survive an Atlanta Storm",      prompt: "A massive storm knocked out power across Atlanta. Plan your survival strategy from each character's perspective. Chaos ensues." },
  { icon: "🏆", title: "Fantasy League Draft Day",      prompt: "It's fantasy football draft day. Everyone makes picks that make absolutely no sense for their character. Roast each other mercilessly." },
  { icon: "🎪", title: "Start a Street Circus",         prompt: "You're starting a pop-up street circus in Little Five Points Atlanta. Assign acts based on your characters' 'abilities'." },
];

// ── AI prompts ───────────────────────────────────────────────────────────────
function buildCreatorSystem(): string {
  return `You are the Fantasy Character Forge. Take a real person's personality and create a wildly over-the-top fantasy version of them.

Given the real person info, return ONLY valid JSON:
{
  "fantasyName": "Epic fantasy name (e.g. 'Pirate Aisha the Undefeated' or 'Jamal the Soccer Wizard Supreme')",
  "title": "Ridiculous official title",
  "catchphrase": "Their signature saying (funny, in character)",
  "origin": "1-sentence absurd backstory origin story",
  "superpower": "Their ridiculous special ability",
  "weakness": "Their silly fatal weakness",
  "quirks": ["quirk 1", "quirk 2", "quirk 3"],
  "humorStyle": "one of: Dry | Absurdist | Sarcastic | Wholesome | Unhinged | Dad Jokes | Philosopher | Chaos Agent",
  "openingLine": "Their first thing they'd say when they enter the chat room (in full character)"
}`;
}

function buildPersonaSystem(friend: FantasyMember, userName: string): string {
  return `You are ${friend.fantasyName} — ${friend.title}.

Origin: ${friend.origin}
Superpower: ${friend.superpower}
Weakness: ${friend.weakness}
Quirks: ${friend.quirks?.join(", ")}
Humor style: ${friend.humorStyle}
Catchphrase: "${friend.catchphrase}"

You are chatting with ${userName} in a private, silly group chat. You are a wildly over-the-top fantasy version of a real person, created with their consent for pure fun.

Rules:
- STAY IN CHARACTER completely — you ARE ${friend.fantasyName}
- Be ridiculous, funny, and lovably over-the-top
- Reference your superpower/weakness naturally in conversation
- Drop your catchphrase occasionally (not every message)
- React to things through your character's lens
- Keep responses conversational (2-5 sentences usually) — this is a chat, not a monologue
- Set in Atlanta, GA — reference local spots naturally when relevant
- Pure wholesome fun — no harmful content`;
}

function buildGroupSystem(friends: FantasyMember[], scenarioTitle: string | null): string {
  const roster = friends.map(f => `- ${f.fantasyName} (${f.title}): ${f.superpower}. Humor: ${f.humorStyle}. Catchphrase: "${f.catchphrase}"`).join("\n");
  return `You are running a ridiculous group chat between these fantasy characters:\n${roster}

${scenarioTitle ? `Current scenario: "${scenarioTitle}"` : "Open group chat."}

Format each response as a chaotic group chat exchange. Each character responds in turn. Use this format:
**[Fantasy Name]:** Their message

Rules:
- Each character stays fully in their own voice and humor style
- Characters can talk to each other, argue, agree, make wild plans
- Reference Atlanta locations naturally
- Keep it silly, warm, and fun — like a group chat with cartoon best friends
- 2-4 messages per character per turn, max 3 characters responding per turn
- End with something that invites the user to respond or sets up the next beat`;
}

function parseJSON<T>(raw: string): T | null {
  try {
    const m = raw.match(/[\[{][\s\S]*[\]}]/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch { return null; }
}

// ── Avatar (image from contact, fallback to archetype emoji) ─────────────────
function Avatar({ friend, contactsById, size = 40 }: {
  friend: FantasyMember;
  contactsById: Map<string, ContactLite>;
  size?: number;
}) {
  const contact = friend.contactId ? contactsById.get(friend.contactId) : undefined;
  const img = contact?.image_upload || contact?.avatar_url || null;
  const meta = archetypeMeta(friend.archetype);

  if (img) {
    return (
      <img
        src={img}
        alt=""
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          flexShrink: 0, border: `2px solid ${C.primary}`,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--crimson-soft)", border: `2px solid ${C.primary}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, flexShrink: 0,
    }}>
      {meta.emoji}
    </div>
  );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────
function Bubble({ msg, crew, contactsById, userName }: {
  msg: ChatMsg;
  crew: FantasyMember[];
  contactsById: Map<string, ContactLite>;
  userName: string;
}) {
  const isUser = msg.role === "user";
  const friend = crew.find(f => f.id === msg.friendId);
  const col = isUser ? C.primary : C.teal;

  if (msg.role === "system") return (
    <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-faint)", padding: "6px 0", fontStyle: "italic" }}>{msg.content}</div>
  );

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}>
      {!isUser && friend && <Avatar friend={friend} contactsById={contactsById} size={32} />}
      {isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "var(--crimson-soft)", border: `1.5px solid ${C.primary}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>👤</div>
      )}
      <div style={{ maxWidth: "72%" }}>
        {!isUser && friend && <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 2 }}>{friend.fantasyName}</div>}
        {isUser && <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 2, textAlign: "right" }}>{userName}</div>}
        <div style={{
          background: isUser ? "var(--crimson-soft)" : "var(--teal-soft)",
          border: `1px solid ${isUser ? "var(--crimson-border)" : "var(--teal-border)"}`,
          borderRadius: isUser ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
          padding: "9px 13px", fontSize: 12, color: "var(--text-dim)",
          lineHeight: 1.7, whiteSpace: "pre-wrap",
        }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 2, textAlign: isUser ? "right" : "left" }}>
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ── Chat input ───────────────────────────────────────────────────────────────
function ChatInput({ onSend, loading, placeholder }: {
  onSend: (t: string) => void;
  loading: boolean;
  placeholder?: string;
}) {
  const [val, setVal] = useState("");
  function send() {
    const t = val.trim();
    if (!t || loading) return;
    onSend(t);
    setVal("");
  }
  return (
    <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 8 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={placeholder || "Say something..."}
        style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none" }}
      />
      <button
        onClick={send}
        disabled={!val.trim() || loading}
        style={{ padding: "9px 18px", borderRadius: 10, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: val.trim() && !loading ? "pointer" : "not-allowed", opacity: val.trim() && !loading ? 1 : 0.4 }}
      >
        Send
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
type TabId = "crew" | "chat" | "group" | "scenarios";

export default function FantasyFriendSimulator({ onBack }: Props) {
  const userName = "Chris";
  const [activeTab, setActiveTab] = useState<TabId>("crew");

  // Crew (sim-local, localStorage)
  const [crew, setCrew] = useState<FantasyMember[]>(() => load<FantasyMember[]>(CREW_KEY, []));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreatorForm>({
    contactId: null, realName: "", relationship: "", personality: "",
    humorNotes: "", archetype: "pirate", consentAck: false,
  });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  // Contacts from Supabase
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");

  const contactsById = useMemo(() => {
    const m = new Map<string, ContactLite>();
    contacts.forEach(c => m.set(c.id, c));
    return m;
  }, [contacts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setContactsLoading(true);
        setContactsError(null);
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, full_name, image_upload, avatar_url, company, job_title")
          .limit(500);
        if (error) throw error;
        if (cancelled) return;
        setContacts((data || []) as ContactLite[]);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not load contacts";
        setContactsError(msg);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Solo chat
  const [soloFriend, setSoloFriend] = useState<FantasyMember | null>(null);
  const [soloMsgs, setSoloMsgs] = useState<ChatMsg[]>([]);
  const [soloHistory, setSoloHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [soloLoading, setSoloLoading] = useState(false);

  // Group room
  const [groupParticipants, setGroupParticipants] = useState<FantasyMember[]>([]);
  const [groupMsgs, setGroupMsgs] = useState<ChatMsg[]>([]);
  const [groupHistory, setGroupHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupStarted, setGroupStarted] = useState(false);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  const soloEndRef = useRef<HTMLDivElement>(null);
  const groupEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { soloEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [soloMsgs, soloLoading]);
  useEffect(() => { groupEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [groupMsgs, groupLoading]);

  // ── Generate persona ─────────────────────────────────────────────────────
  const generatePersona = useCallback(async () => {
    if (!form.realName.trim() || !form.consentAck) return;
    setGenerating(true); setPreview(null);
    try {
      const meta = archetypeMeta(form.archetype);
      const contactLine = form.contactId && contactsById.has(form.contactId)
        ? `Linked contact: ${displayContactName(contactsById.get(form.contactId)!)}`
        : null;
      const prompt = [
        `Real name: ${form.realName}`,
        contactLine,
        `Relationship: ${form.relationship || "friend"}`,
        `Personality: ${form.personality}`,
        `Humor notes: ${form.humorNotes}`,
        `Fantasy archetype: ${meta.label}`,
      ].filter(Boolean).join("\n");

      const result = await invokeLLM({
        systemPrompt: buildCreatorSystem(),
        prompt,
      });
      const raw = result.text || result.content || "";
      const parsed = parseJSON<PreviewData>(raw);
      if (parsed) setPreview(parsed);
    } finally {
      setGenerating(false);
    }
  }, [form, contactsById]);

  function addToCrew() {
    if (!preview) return;
    const member: FantasyMember = {
      ...preview,
      id: Date.now(),
      contactId: form.contactId,
      realName: form.realName,
      archetype: form.archetype,
      addedAt: new Date().toISOString(),
    };
    const next = [...crew, member];
    setCrew(next); save(CREW_KEY, next);
    setPreview(null); setCreating(false);
    setForm({ contactId: null, realName: "", relationship: "", personality: "", humorNotes: "", archetype: "pirate", consentAck: false });
  }

  function removeMember(id: number) {
    const next = crew.filter(m => m.id !== id);
    setCrew(next); save(CREW_KEY, next);
    if (soloFriend?.id === id) setSoloFriend(null);
  }

  // ── Solo chat ────────────────────────────────────────────────────────────
  function startSoloChat(friend: FantasyMember) {
    setSoloFriend(friend);
    setSoloMsgs([
      { role: "system", content: `${friend.fantasyName} has entered the chat.`, ts: Date.now() },
      { role: "friend", friendId: friend.id, content: friend.openingLine || `Greetings! I am ${friend.fantasyName}!`, ts: Date.now() },
    ]);
    setSoloHistory([]);
    setActiveTab("chat");
  }

  const sendSolo = useCallback(async (text: string) => {
    if (!soloFriend || soloLoading) return;
    const userMsg: ChatMsg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...soloHistory, { role: "user" as const, content: text }];
    setSoloMsgs(m => [...m, userMsg]);
    setSoloHistory(newHistory);
    setSoloLoading(true);
    try {
      const result = await invokeLLM({
        systemPrompt: buildPersonaSystem(soloFriend, userName),
        prompt: text,
      });
      const content = result.text || result.content || "";
      const reply: ChatMsg = { role: "friend", friendId: soloFriend.id, content, ts: Date.now() };
      setSoloMsgs(m => [...m, reply]);
      setSoloHistory(h => [...h, { role: "assistant", content }]);
    } finally {
      setSoloLoading(false);
    }
  }, [soloFriend, soloLoading, soloHistory, userName]);

  // ── Group chat ───────────────────────────────────────────────────────────
  function startGroup() {
    if (groupParticipants.length < 2) return;
    setGroupStarted(true);
    const openings = groupParticipants.map(f => `${f.fantasyName}: "${f.openingLine || "Let's gooo!"}"`).join("\n");
    setGroupMsgs([
      { role: "system", content: `Group chat started with ${groupParticipants.map(f => f.fantasyName).join(", ")}`, ts: Date.now() },
      { role: "group", friendId: "group", content: openings, ts: Date.now() },
    ]);
    setGroupHistory([]);
  }

  const sendGroup = useCallback(async (text: string) => {
    if (!groupStarted || groupLoading) return;
    const userMsg: ChatMsg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...groupHistory, { role: "user" as const, content: text }];
    setGroupMsgs(m => [...m, userMsg]);
    setGroupHistory(newHistory);
    setGroupLoading(true);
    try {
      const result = await invokeLLM({
        systemPrompt: buildGroupSystem(groupParticipants, activeScenario?.title ?? null),
        prompt: text,
      });
      const content = result.text || result.content || "";
      const reply: ChatMsg = { role: "group", friendId: "group", content, ts: Date.now() };
      setGroupMsgs(m => [...m, reply]);
      setGroupHistory(h => [...h, { role: "assistant", content }]);
    } finally {
      setGroupLoading(false);
    }
  }, [groupStarted, groupLoading, groupHistory, groupParticipants, activeScenario]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 };
  const inp = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" as const, width: "100%" };
  const btnS = (col: string) => ({ padding: "6px 14px", borderRadius: 8, background: `color-mix(in srgb, ${col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" as const });

  const TABS: { id: TabId; label: string }[] = [
    { id: "crew",      label: "🎪 The Crew" },
    { id: "chat",      label: "💬 Solo Chat" },
    { id: "group",     label: "🎭 Group Room" },
    { id: "scenarios", label: "🎲 Scenarios" },
  ];

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => displayContactName(c).toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, var(--crimson-soft), rgba(0,148,136,0.06))`, borderBottom: "1px solid var(--crimson-border)", padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>}
          {onBack && <span style={{ color: C.border }}>|</span>}
          <span style={{ fontSize: 20 }}>👻</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>Fantasy Friend Simulator</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Hang out with ridiculous, over-the-top fantasy versions of your people</div>
          </div>
          {crew.length > 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{crew.length}</div>
              <div style={{ fontSize: 9, color: "var(--text-faint)" }}>Crew Members</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "var(--card-alt)", borderBottom: "1px solid var(--border-soft)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: "6px 13px", borderRadius: 8, cursor: "pointer",
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              background: activeTab === t.id ? "var(--crimson-soft)" : "transparent",
              color: activeTab === t.id ? C.primary : "var(--text-muted)",
              border: "none",
              borderBottom: activeTab === t.id ? `2px solid ${C.primary}` : "2px solid transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CREW TAB ── */}
      {activeTab === "crew" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Your Fantasy Crew</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Consent-based, wildly over-the-top fantasy versions of your people</div>
            </div>
            {!creating && (
              <button onClick={() => setCreating(true)}
                style={{ padding: "8px 18px", borderRadius: 10, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                + Add Member
              </button>
            )}
          </div>

          {/* Creator form */}
          {creating && (
            <div style={{ ...card, padding: 20, marginBottom: 20, border: "1px solid var(--crimson-border)" }}>
              <div style={{ fontSize: 11, color: C.primary, fontWeight: 700, marginBottom: 14 }}>CREATE FANTASY PERSONA</div>

              <div style={{ background: "var(--warning-soft)", border: "1px solid var(--warning-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "var(--warning)" }}>
                ⚖️ Only add people who have explicitly consented or would clearly enjoy this. These are private, silly, cartoon versions — never for serious purposes.
              </div>

              {/* Contact picker */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  🖼️ Link a real contact (optional — pulls their photo)
                </label>
                {contactsLoading && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0" }}>Loading contacts…</div>
                )}
                {contactsError && !contactsLoading && (
                  <div style={{ fontSize: 11, color: "var(--danger)", padding: "8px 0" }}>
                    Could not load contacts ({contactsError}). Manual entry still works.
                  </div>
                )}
                {!contactsLoading && !contactsError && (
                  <>
                    {contacts.length > 6 && (
                      <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                        placeholder="Search contacts..." style={{ ...inp, marginBottom: 8 }} />
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                      {filteredContacts.slice(0, 60).map(c => {
                        const sel = form.contactId === c.id;
                        const img = c.image_upload || c.avatar_url;
                        return (
                          <button key={c.id} onClick={() => setForm(v => ({
                            ...v,
                            contactId: sel ? null : c.id,
                            realName: sel ? v.realName : (v.realName || displayContactName(c)),
                          }))}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "6px 12px", borderRadius: 20,
                              border: `1px solid ${sel ? C.primary : C.border}`,
                              background: sel ? "var(--crimson-soft)" : "transparent",
                              color: sel ? C.primary : "var(--text-dim)",
                              fontSize: 11, cursor: "pointer", fontWeight: sel ? 700 : 400,
                            }}>
                            {img ? (
                              <img src={img} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.bg3, display: "inline-block" }} />
                            )}
                            {displayContactName(c)}
                          </button>
                        );
                      })}
                      {filteredContacts.length === 0 && contacts.length > 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>No matches.</div>
                      )}
                      {contacts.length === 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>No contacts in your list yet.</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Real Name *</label>
                  <input value={form.realName} onChange={e => setForm(v => ({ ...v, realName: e.target.value }))}
                    placeholder="e.g. Marcus" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>How you know them</label>
                  <input value={form.relationship} onChange={e => setForm(v => ({ ...v, relationship: e.target.value }))}
                    placeholder="e.g. College buddy, business partner" style={inp} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Their Personality</label>
                <input value={form.personality} onChange={e => setForm(v => ({ ...v, personality: e.target.value }))}
                  placeholder="e.g. super competitive, obsessed with soccer, always the loudest in the room, big heart" style={inp} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Humor style or inside jokes (optional)</label>
                <input value={form.humorNotes} onChange={e => setForm(v => ({ ...v, humorNotes: e.target.value }))}
                  placeholder="e.g. loves terrible puns, always talks trash at sports, obsessed with BBQ" style={inp} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Fantasy Archetype</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ARCHETYPES.map(a => {
                    const sel = form.archetype === a.id;
                    return (
                      <button key={a.id} onClick={() => setForm(v => ({ ...v, archetype: a.id }))}
                        style={{
                          padding: "5px 12px", borderRadius: 20,
                          border: `1px solid ${sel ? C.primary : C.border}`,
                          background: sel ? "var(--crimson-soft)" : "transparent",
                          color: sel ? C.primary : "var(--text-dim)",
                          fontSize: 11, cursor: "pointer", fontWeight: sel ? 700 : 400,
                        }}>
                        {a.emoji} {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label style={{ display: "flex", gap: 8, marginBottom: 14, cursor: "pointer", alignItems: "flex-start" }}>
                <input type="checkbox" checked={form.consentAck}
                  onChange={e => setForm(v => ({ ...v, consentAck: e.target.checked }))}
                  style={{ marginTop: 2, accentColor: C.primary }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  {form.realName || "This person"} has consented or would clearly enjoy being in this silly, private simulation. Sessions are ephemeral and never shared without my action.
                </span>
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={generatePersona}
                  disabled={generating || !form.realName.trim() || !form.consentAck}
                  style={{
                    padding: "9px 20px", borderRadius: 10,
                    background: "var(--grad-crimson)", border: "none", color: "#fff",
                    fontSize: 12, fontWeight: 800,
                    cursor: form.realName.trim() && form.consentAck && !generating ? "pointer" : "not-allowed",
                    opacity: form.realName.trim() && form.consentAck ? 1 : 0.4,
                  }}>
                  {generating ? "🎪 Generating..." : "🎪 Generate Fantasy Persona"}
                </button>
                <button onClick={() => { setCreating(false); setPreview(null); }} style={btnS("var(--danger)")}>
                  Cancel
                </button>
              </div>

              {preview && (
                <div style={{ marginTop: 16, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 10 }}>FANTASY PERSONA PREVIEW</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 2 }}>{preview.fantasyName}</div>
                  <div style={{ fontSize: 11, color: C.amber, marginBottom: 10 }}>{preview.title}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {([
                      ["Origin", preview.origin],
                      ["Superpower", preview.superpower],
                      ["Weakness", preview.weakness],
                      ["Humor Style", preview.humorStyle],
                    ] as const).map(([label, val]) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 700, marginBottom: 2 }}>{label.toUpperCase()}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.primary, marginBottom: 6 }}>
                    Catchphrase: <span style={{ fontStyle: "italic" }}>"{preview.catchphrase}"</span>
                  </div>
                  {preview.quirks?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {preview.quirks.map(q => (
                        <span key={q} style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: "var(--crimson-soft)", color: C.primary }}>{q}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic", marginBottom: 12 }}>
                    Opening line: "{preview.openingLine}"
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={addToCrew}
                      style={{ padding: "8px 20px", borderRadius: 10, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      Add to Crew ✓
                    </button>
                    <button onClick={generatePersona} style={btnS(C.primary)}>Regenerate</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Crew grid */}
          {crew.length === 0 && !creating ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎪</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 8 }}>Your crew is empty</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 340, margin: "0 auto 20px" }}>
                Add fantasy versions of your friends to start the most ridiculous group chat in Atlanta.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {crew.map(member => (
                <div key={member.id} style={{ background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 14, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <Avatar friend={member} contactsById={contactsById} size={42} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{member.fantasyName}</div>
                      <div style={{ fontSize: 10, color: C.primary }}>{member.title}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>⚡ {member.superpower}</div>
                  <div style={{ fontSize: 11, color: C.amber, fontStyle: "italic", marginBottom: 10 }}>"{member.catchphrase}"</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startSoloChat(member)}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, background: "var(--teal-soft)", border: "1px solid var(--teal-border)", color: C.teal, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      💬 Chat
                    </button>
                    <button onClick={() => removeMember(member.id)}
                      style={{ ...btnS("var(--danger)"), padding: "7px 10px" }}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SOLO CHAT TAB ── */}
      {activeTab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!soloFriend ? (
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Pick Who to Chat With</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>One-on-one with your fantasy friend</div>
              {crew.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                  <div>Add crew members first.</div>
                  <button onClick={() => setActiveTab("crew")} style={{ ...btnS(C.primary), marginTop: 12 }}>Go to Crew</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {crew.map(m => (
                    <button key={m.id} onClick={() => startSoloChat(m)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", textAlign: "left" }}>
                      <Avatar friend={m} contactsById={contactsById} size={36} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{m.fantasyName}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.humorStyle} humor · {archetypeMeta(m.archetype).label}</div>
                      </div>
                      <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>Chat →</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--card-alt)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <Avatar friend={soloFriend} contactsById={contactsById} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{soloFriend.fantasyName}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{soloFriend.title}</div>
                </div>
                <button onClick={() => setSoloFriend(null)} style={btnS("var(--danger)")}>← Back</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {soloMsgs.map((m, i) => <Bubble key={i} msg={m} crew={crew} contactsById={contactsById} userName={userName} />)}
                {soloLoading && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
                    <Avatar friend={soloFriend} contactsById={contactsById} size={28} />
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, animation: `ffPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={soloEndRef} />
              </div>
              <ChatInput onSend={sendSolo} loading={soloLoading} placeholder={`Talk to ${soloFriend.fantasyName}...`} />
            </div>
          )}
        </div>
      )}

      {/* ── GROUP ROOM TAB ── */}
      {activeTab === "group" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!groupStarted ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Group Room Setup</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>Pick 2+ crew members. Watch them interact, or jump in.</div>

                {crew.length < 2 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    <div>You need at least 2 crew members. Add more in the Crew tab.</div>
                    <button onClick={() => setActiveTab("crew")} style={{ ...btnS(C.primary), marginTop: 12 }}>Go to Crew</button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 8 }}>SELECT PARTICIPANTS (min 2)</div>
                      {crew.map(m => {
                        const sel = groupParticipants.some(p => p.id === m.id);
                        return (
                          <div key={m.id}
                            onClick={() => setGroupParticipants(prev => sel ? prev.filter(p => p.id !== m.id) : [...prev, m])}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "10px 12px", borderRadius: 12,
                              border: `1px solid ${sel ? C.primary : C.border}`,
                              background: sel ? "var(--crimson-soft)" : "transparent",
                              cursor: "pointer", marginBottom: 8,
                            }}>
                            <Avatar friend={m} contactsById={contactsById} size={30} />
                            <span style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? C.primary : "var(--text-dim)" }}>{m.fantasyName}</span>
                            {sel && <span style={{ marginLeft: "auto", color: C.primary, fontSize: 14 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>

                    {activeScenario && (
                      <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--warning-soft)", border: "1px solid var(--warning-border)", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 18 }}>{activeScenario.icon}</span>
                        <span style={{ flex: 1, fontSize: 12, color: "var(--warning)", fontWeight: 600 }}>{activeScenario.title}</span>
                        <button onClick={() => setActiveScenario(null)} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer" }}>×</button>
                      </div>
                    )}

                    <button onClick={startGroup} disabled={groupParticipants.length < 2}
                      style={{
                        width: "100%", padding: 12, borderRadius: 12,
                        background: "var(--grad-crimson)", border: "none", color: "#fff",
                        fontSize: 13, fontWeight: 800,
                        cursor: groupParticipants.length >= 2 ? "pointer" : "not-allowed",
                        opacity: groupParticipants.length >= 2 ? 1 : 0.4,
                      }}>
                      🎭 Start Group Chat
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--card-alt)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <div style={{ display: "flex" }}>
                  {groupParticipants.slice(0, 4).map(m => (
                    <div key={m.id} style={{ marginLeft: -6 }}>
                      <Avatar friend={m} contactsById={contactsById} size={26} />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.white, flex: 1 }}>
                  {groupParticipants.map(m => m.realName).join(", ")}
                </span>
                <button onClick={() => { setGroupStarted(false); setGroupMsgs([]); setGroupHistory([]); }} style={btnS("var(--danger)")}>End Session</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {groupMsgs.map((m, i) => {
                  if (m.role === "system") return (
                    <div key={i} style={{ textAlign: "center", fontSize: 10, color: "var(--text-faint)", padding: "4px 0", fontStyle: "italic" }}>{m.content}</div>
                  );
                  if (m.role === "user") return <Bubble key={i} msg={m} crew={crew} contactsById={contactsById} userName={userName} />;
                  return (
                    <div key={i} style={{
                      background: "var(--card-alt)", border: "1px solid var(--border-soft)",
                      borderRadius: 12, padding: "12px 14px", marginBottom: 12,
                      fontSize: 12, color: "var(--text-dim)", lineHeight: 1.8, whiteSpace: "pre-wrap",
                    }}>
                      {m.content}
                    </div>
                  );
                })}
                {groupLoading && (
                  <div style={{ display: "flex", gap: 4, padding: "8px 0", alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, animation: `ffPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                    ))}
                    <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 6 }}>Characters responding...</span>
                  </div>
                )}
                <div ref={groupEndRef} />
              </div>
              <ChatInput onSend={sendGroup} loading={groupLoading} placeholder="Jump into the chaos..." />
            </div>
          )}
        </div>
      )}

      {/* ── SCENARIOS TAB ── */}
      {activeTab === "scenarios" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Atlanta Scenario Starters</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>Pick a scenario, then go to Group Room to run it with your crew</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {SCENARIOS.map(s => {
              const sel = activeScenario?.title === s.title;
              return (
                <div key={s.title} onClick={() => setActiveScenario(sel ? null : s)}
                  style={{
                    background: sel ? "var(--warning-soft)" : C.card,
                    border: `1px solid ${sel ? "var(--warning-border)" : C.border}`,
                    borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.15s",
                  }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: sel ? "var(--warning)" : C.white, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{s.prompt.slice(0, 80)}...</div>
                  {sel && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--warning)", fontWeight: 700 }}>
                      ✓ Selected · Go to Group Room →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {activeScenario && (
            <div style={{ position: "sticky", bottom: 0, padding: "12px 0 0" }}>
              <button onClick={() => setActiveTab("group")}
                style={{ width: "100%", padding: 12, borderRadius: 12, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                🎲 Launch "{activeScenario.title}" in Group Room
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes ffPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────
function displayContactName(c: ContactLite): string {
  if (c.full_name && c.full_name.trim()) return c.full_name.trim();
  const f = (c.first_name || "").trim();
  const l = (c.last_name || "").trim();
  const both = `${f} ${l}`.trim();
  return both || "(no name)";
}