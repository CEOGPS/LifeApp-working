// src/pages/simulators/DarkCardGame.tsx
import { C } from "@/lib/palette";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { invokeLLM } from "@/lib/llm";

// ── Types ────────────────────────────────────────────────────────────────────
interface Player { id: number; name: string; score: number; }
interface HandCard { text: string; playerId: number; }
interface Judgement { score: number; verdict: string; reaction: string; }
interface RoundLog { round: number; black: string; white: string; winner: string; verdict?: string; czar: string; }

interface Props { onBack?: () => void; }

// ── CSS custom properties used (documentation; defined in index.css) ─────────
// --crimson-soft, --crimson-border, --grad-crimson
// --card-alt, --border-soft, --border-strong
// --text-dim, --text-muted, --text-faint
// --danger, --danger-soft

// ── Static starter deck ──────────────────────────────────────────────────────
const STARTER_BLACK = [
  "The real reason I-285 is always backed up: ___.",
  "HR's email subject line of the year: ___.",
  "My therapist finally told me the truth: ___.",
  "The one thing nobody mentions at the Atlanta Chamber of Commerce: ___.",
  "Millennials can't afford houses because of ___.",
  "During the quarterly review, the CEO accidentally revealed ___.",
  "The startup pitch: 'We're basically Uber, but for ___.'",
  "What they don't tell you in the wedding vows: ___.",
  "My LinkedIn headline: 'Passionate about ___ and making it everyone's problem.'",
  "The real five stages of grief: denial, anger, bargaining, ___, and ordering Waffle House at 2am.",
  "At my funeral, please play ___ and tell everyone I died doing what I loved: ___.",
  "The app nobody asked for but Silicon Valley funded anyway: ___ for ___.",
  "What Grandma actually meant at Thanksgiving: ___.",
  "The reason the company went under: surprisingly, it was ___.",
  "I told my kids I was working from home. I was actually ___.",
  "The plot twist nobody saw coming: the villain was ___ all along.",
  "Atlanta summers feel like ___ wearing ___ in a ___ with no AC.",
  "My side hustle: professionally ___.",
  "The one text I should never have sent: ___.",
  "The secret ingredient in every successful Atlanta business: ___.",
  "New diet plan: replace breakfast with ___, lunch with regret, dinner with ___.",
  "The last thing you want to hear your boss say over Zoom: ___.",
  "My love language is ___, but my bank statement says ___.",
  "Scientists have finally confirmed that ___ is, in fact, a personality disorder.",
  "The thing that finally killed small talk: ___.",
];

const STARTER_WHITE = [
  "Aggressively mediocre LinkedIn content",
  "Crying in a Chick-fil-A parking lot",
  "A passive-aggressive Slack message",
  "Declaring bankruptcy at Dave & Buster's",
  "A subscription you forgot to cancel three years ago",
  "Your uncle's conspiracy podcast",
  "Weaponized eye contact",
  "A motivational poster about synergy",
  "Sending 'per my last email' and meaning war",
  "The audacity of middle management",
  "Existing in Atlanta traffic for 45 minutes to go 2 miles",
  "Telling someone you're an entrepreneur",
  "A participation trophy from 1997",
  "Crying but making it a brand",
  "Starting a podcast about productivity",
  "Bringing up your zodiac sign as a personality",
  "Accidentally replying-all",
  "A LinkedIn connection request from someone you actively avoid",
  "Asking if the meeting could've been an email",
  "The hollow eyes of someone on their fourth Zoom call",
  "Putting 'visionary' in your email signature",
  "A food truck that only sells one thing and runs out in 20 minutes",
  "Unsubscribing from a mailing list and still getting emails",
  "Your ex's new personality",
  "Calling a 10-minute task 'a deep dive'",
  "Describing yourself as 'passionate' without elaborating",
  "A group chat that never should have existed",
  "The phrase 'circle back'",
  "Starting over at 40 with a dream and no plan",
  "Posting gym selfies as a coping mechanism",
  "Telling someone their energy is 'a lot'",
  "A business loan spent on vibes",
  "The look your dog gives you during a work call",
  "An MLM pitch disguised as a coffee chat",
  "Unsolicited financial advice from someone in debt",
  "Moving back in with your parents to 'save up'",
  "A Twitter thread nobody asked for",
  "Calling yourself a 'creative' while refusing all structure",
  "A three-hour meeting that could've been a text",
  "The sunk cost of a gym membership",
  "A notification from an app you downloaded once in 2019",
  "Manifesting instead of applying",
  "Putting Wakanda Forever in your bio",
  "An NFT your cousin sold you",
  "Emotional support purchases from Amazon at 11pm",
  "The audacity to charge that much for a salad",
  "A 'no drama' person causing all the drama",
  "Explaining your personality using Myers-Briggs",
  "An exit interview where you finally say everything",
  "The fifth 'final reminder' email",
];

const DECK_THEMES = [
  { id: "corporate",  label: "💼 Corporate Hell",  desc: "Meetings, HR, and the slow death of the soul" },
  { id: "atlanta",    label: "🍑 Atlanta Life",    desc: "Traffic, heat, Chick-fil-A, and gentrification" },
  { id: "millennial", label: "😭 Millennial Pain", desc: "Debt, avocado toast, and existential dread" },
  { id: "social",     label: "📱 Social Media",    desc: "Influencers, LinkedIn, and clout chasing" },
  { id: "family",     label: "🦃 Family Drama",    desc: "Thanksgiving, group chats, and passive aggression" },
  { id: "startup",    label: "🚀 Startup Chaos",   desc: "Disruption, pivot culture, and burning cash" },
];

const DIFFICULTY = [
  { id: "mild",  label: "😈 Edgy",     desc: "Dark but office-safe" },
  { id: "dark",  label: "🖤 Dark",     desc: "Legitimately uncomfortable" },
  { id: "abyss", label: "🕳️ The Abyss", desc: "No going back" },
];

// All verdict colors stay in the crimson/amber/red family — no stray hues.
const VERDICT_COLOR: Record<string, string> = {
  "Devastating":         "var(--danger)",
  "Painfully Accurate":  "var(--warning)",
  "Chaotic Neutral":     "var(--text-muted)",
  "Too Real":            C.primary,
  "Unhinged":            C.primary,
  "Peak Cringe":         "var(--warning)",
  "Actually Funny":      C.green,
  "Deeply Wrong":        "var(--danger)",
  "Chef's Kiss":         C.primary,
};

// ── AI prompts ────────────────────────────────────────────────────────────────
function buildBlackCardSystem(theme: string, difficulty: string): string {
  const diffMap: Record<string, string> = {
    mild:  "edgy but workplace-safe — uncomfortable but not crossing any lines",
    dark:  "genuinely dark, bleak, or cringe — no explicit content but emotionally devastating humor",
    abyss: "deeply cynical, existentially horrifying, or so accurate it hurts — still no explicit content",
  };
  return `You are an AI card generator for a dark humor party game inspired by Cards Against Humanity. Generate ONLY the cards, no explanation.

Tone: ${diffMap[difficulty] ?? diffMap.dark}
Theme focus: ${theme}
Location context: Atlanta, GA

Generate 1 BLACK CARD (the prompt with a ___ blank). Rules:
- 8-20 words
- Must be a fill-in-the-blank or pick-two scenario
- Dark, bleak, cringe, or absurdist humor
- No explicit sexual content, slurs, or content targeting real private individuals
- Reference real life (corporate culture, family, social media, Atlanta, relationships, money) in uncomfortable ways
- Make the blank feel wide open for horrifying answers

Return ONLY the card text. No quotes, no explanation. Example format: "The real reason nobody at this company gets promoted: ___.";`;
}

function buildWhiteCardSystem(blackCard: string, count: number, difficulty: string): string {
  return `You are generating answer cards for a dark humor card game. Fill the blank in this black card with ${count} funny, dark, cringe, or absurdist answers.

Black card: "${blackCard}"

Rules:
- Each answer: 3-12 words, punchy, standalone
- Dark, bleak, uncomfortable, or painfully relatable humor
- No explicit sexual content or slurs
- Think: LinkedIn culture, existential dread, corporate dysfunction, family dysfunction, social media cringe, Atlanta life, millennial/Gen-Z pain, startup BS
- Answers should range from painfully accurate to completely absurd

Return ONLY a JSON array of ${count} strings. Example: ["answer one", "answer two"]`;
}

function buildJudgeSystem(): string {
  return `You are the AI Card Czar for a dark humor party game. Score the submitted answer card for this round.

Return ONLY valid JSON: { "score": 8, "verdict": "one of: Devastating | Painfully Accurate | Chaotic Neutral | Too Real | Unhinged | Peak Cringe | Actually Funny | Deeply Wrong | Chef's Kiss", "reaction": "1-sentence funny reaction from the Czar (in character as a disappointed judge)" }`;
}

function parseJSON<T>(raw: string): T | null {
  try {
    const m = raw.match(/[\[{][\s\S]*[\]}]/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch { return null; }
}

// ── Card components ───────────────────────────────────────────────────────────
function BlackCard({ text, loading }: { text: string; loading?: boolean }) {
  return (
    <div style={{ background: "#0a0a0a", border: "2px solid var(--border-strong)", borderRadius: 16, padding: "24px 22px", minHeight: 140, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
      {loading ? (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.white, animation: `cardPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
        </div>
      ) : (
        <div style={{ fontSize: 17, fontWeight: 700, color: C.white, lineHeight: 1.6 }}>{text}</div>
      )}
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 12, textAlign: "right" }}>VOID CARDS™</div>
    </div>
  );
}

function WhiteCard({ text, selected, onClick, revealed, score, verdict, reaction, disabled, highlightWinner }: {
  text: string; selected: boolean; onClick?: () => void; revealed?: boolean;
  score?: number; verdict?: string; reaction?: string; disabled?: boolean; highlightWinner?: boolean;
}) {
  const verdictCol = verdict ? (VERDICT_COLOR[verdict] ?? C.primary) : C.primary;
  return (
    <div onClick={!disabled ? onClick : undefined}
      style={{
        background: selected ? C.white : "rgba(255,255,255,0.94)",
        border: `2px solid ${highlightWinner ? C.primary : selected ? C.primary : "transparent"}`,
        borderRadius: 12, padding: "12px 14px",
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.15s",
        transform: selected ? "scale(1.02)" : "scale(1)",
        boxShadow: highlightWinner ? `0 0 24px color-mix(in srgb, ${C.primary} 50%, transparent)` : selected ? `0 4px 20px color-mix(in srgb, ${C.primary} 25%, transparent)` : "0 2px 8px rgba(0,0,0,0.3)",
        minHeight: 70,
      }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#0a0a0a", lineHeight: 1.5 }}>{text}</div>
      {revealed && score !== undefined && (
        <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, background: "#0a0a0a", display: "inline-block" }}>
          <span style={{ fontSize: 10, color: verdictCol, fontWeight: 700 }}>{score}/10 · {verdict}</span>
        </div>
      )}
      {revealed && reaction && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#555", fontStyle: "italic" }}>{reaction}</div>
      )}
    </div>
  );
}

// ── Score board ───────────────────────────────────────────────────────────────
function Scoreboard({ players, czarIndex }: { players: Player[]; czarIndex: number }) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sorted.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, background: i === 0 ? "var(--crimson-soft)" : "rgba(255,255,255,0.03)" }}>
          <span style={{ fontSize: 12 }}>{i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}</span>
          <span style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: i === 0 ? 700 : 400 }}>{p.name}</span>
          {czarIndex >= 0 && players[czarIndex]?.id === p.id && <span style={{ fontSize: 9, color: C.primary, fontWeight: 700 }}>CZAR</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{p.score} ⚫</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type Screen = "setup" | "game" | "results";
type Phase = "play" | "judging" | "reveal" | "winner";

export default function DarkCardGame({ onBack }: Props) {
  const [screen, setScreen] = useState<Screen>("setup");

  const [players, setPlayers] = useState<Player[]>([{ id: 1, name: "Chris", score: 0 }, { id: 2, name: "Player 2", score: 0 }]);
  const [newName, setNewName] = useState("");
  const [theme, setTheme] = useState("corporate");
  const [difficulty, setDifficulty] = useState("dark");
  const [winScore, setWinScore] = useState(7);
  const [setupError, setSetupError] = useState("");

  const [round, setRound] = useState(1);
  const [czarIndex, setCzarIndex] = useState(0);
  const [blackCard, setBlackCard] = useState("");
  const [whiteCards, setWhiteCards] = useState<HandCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("play");
  const [judgements, setJudgements] = useState<Record<number, Judgement>>({});
  const [winner, setWinner] = useState<Player | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [judging, setJudging] = useState(false);

  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [customBlack, setCustomBlack] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("voidcards_black") || "[]") as string[]; } catch { return []; }
  });
  const [customWhite, setCustomWhite] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("voidcards_white") || "[]") as string[]; } catch { return []; }
  });
  const [customBlackInput, setCustomBlackInput] = useState("");
  const [customWhiteInput, setCustomWhiteInput] = useState("");

  const [history, setHistory] = useState<RoundLog[]>([]);

  const seenBlack = useRef<Set<string>>(new Set());
  const seenWhite = useRef<Set<string>>(new Set());

  const [timerOn, setTimerOn] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  useEffect(() => {
    if (!timerOn || phase !== "play" || screen !== "game") return;
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerOn, phase, screen, timeLeft]);

  useEffect(() => { localStorage.setItem("voidcards_black", JSON.stringify(customBlack)); }, [customBlack]);
  useEffect(() => { localStorage.setItem("voidcards_white", JSON.stringify(customWhite)); }, [customWhite]);

  const nonCzarPlayers = useMemo(() => players.filter((_, i) => i !== czarIndex), [players, czarIndex]);
  const czar = players[czarIndex];

  function addPlayer() {
    const trimmed = newName.trim();
    if (!trimmed || players.length >= 8) return;
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setSetupError("That name is already taken.");
      return;
    }
    setPlayers(p => [...p, { id: Date.now(), name: trimmed, score: 0 }]);
    setNewName("");
    setSetupError("");
  }
  function removePlayer(id: number) { if (players.length > 2) setPlayers(p => p.filter(x => x.id !== id)); }

  function pickBlack(): string {
    const all = [...STARTER_BLACK, ...customBlack];
    const fresh = all.filter(c => !seenBlack.current.has(c));
    const pool = fresh.length > 0 ? fresh : all;
    if (fresh.length === 0) seenBlack.current.clear();
    const choice = pool[Math.floor(Math.random() * pool.length)];
    seenBlack.current.add(choice);
    return choice;
  }
  function pickWhites(count: number): string[] {
    const all = [...STARTER_WHITE, ...customWhite];
    const fresh = all.filter(c => !seenWhite.current.has(c));
    const pool = fresh.length >= count ? fresh : all;
    if (fresh.length < count) seenWhite.current.clear();
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);
    picked.forEach(c => seenWhite.current.add(c));
    return picked;
  }

  const dealRound = useCallback(() => {
    setPhase("play");
    setSelectedCard(null);
    setJudgements({});
    setWinner(null);
    setTimeLeft(60);

    const black = pickBlack();
    setBlackCard(black);

    const count = Math.max(8, nonCzarPlayers.length * 2);
    const whites = pickWhites(count);
    setWhiteCards(whites.map((text, i) => ({
      text,
      playerId: nonCzarPlayers[i % Math.max(nonCzarPlayers.length, 1)]?.id ?? players[0].id,
    })));
  }, [nonCzarPlayers, players]);

  const aiGenerateRound = useCallback(async () => {
    setGenLoading(true);
    setPhase("play");
    setSelectedCard(null);
    setJudgements({});
    setWinner(null);
    setTimeLeft(60);

    const blackResult = await invokeLLM({
      systemPrompt: buildBlackCardSystem(theme, difficulty),
      prompt: "Generate 1 dark humor black card now.",
    }).catch(() => ({ text: "", content: "" }));
    const newBlack = (blackResult.text || blackResult.content || "").trim().replace(/^["']|["']$/g, "") || pickBlack();
    setBlackCard(newBlack);

    const whiteResult = await invokeLLM({
      systemPrompt: buildWhiteCardSystem(newBlack, 10, difficulty),
      prompt: "Generate 10 answer cards now.",
    }).catch(() => ({ text: "[]", content: "[]" }));
    const parsed = parseJSON<string[]>((whiteResult.text || whiteResult.content || "[]"));
    const whites = Array.isArray(parsed) && parsed.length > 0
      ? parsed.map(String)
      : pickWhites(10);
    setWhiteCards(whites.map((text, i) => ({
      text,
      playerId: nonCzarPlayers[i % Math.max(nonCzarPlayers.length, 1)]?.id ?? players[0].id,
    })));
    setGenLoading(false);
  }, [theme, difficulty, nonCzarPlayers, players]);

  function startGame() {
    const cleaned = players.map(p => ({ ...p, name: p.name.trim() }));
    if (cleaned.some(p => !p.name)) { setSetupError("Every player needs a name."); return; }
    const lowered = cleaned.map(p => p.name.toLowerCase());
    if (new Set(lowered).size !== lowered.length) { setSetupError("Player names must be unique."); return; }
    setSetupError("");

    setPlayers(cleaned.map(p => ({ ...p, score: 0 })));
    setRound(1);
    setCzarIndex(0);
    setHistory([]);
    seenBlack.current.clear();
    seenWhite.current.clear();
    setScreen("game");
    setTimeout(() => dealRound(), 0);
  }

  async function submitPick() {
    if (selectedCard === null) return;
    setPhase("judging");
    setJudging(true);

    const results: Record<number, Judgement> = {};
    await Promise.all(whiteCards.map(async (card, i) => {
      const result = await invokeLLM({
        systemPrompt: buildJudgeSystem(),
        prompt: `Black card: "${blackCard}"\nSubmitted answer: "${card.text}"\nJudge this answer.`,
      }).catch(() => ({ text: "{}", content: "{}" }));
      const raw = result.text || result.content || "{}";
      const j = parseJSON<Judgement>(raw) ?? { score: 7, verdict: "Actually Funny", reaction: "I've seen worse. Which is saying something." };
      results[i] = j;
    }));

    setJudgements(results);
    setJudging(false);
    setPhase("reveal");
  }

  function confirmWinner() {
    if (selectedCard === null) return;
    const card = whiteCards[selectedCard];
    const winnerId = card.playerId;
    const winnerPlayer = players.find(p => p.id === winnerId) ?? null;
    setWinner(winnerPlayer);
    setPlayers(prev => prev.map(p => p.id === winnerId ? { ...p, score: p.score + 1 } : p));

    const j = judgements[selectedCard];
    setHistory(h => [...h, {
      round,
      black: blackCard,
      white: card.text,
      winner: winnerPlayer?.name ?? "Unknown",
      verdict: j?.verdict,
      czar: czar?.name ?? "Czar",
    }]);
    setPhase("winner");
  }

  function nextRound() {
    const gameWinner = players.find(p => p.score >= winScore);
    if (gameWinner) { setScreen("results"); return; }
    const nextCzar = (czarIndex + 1) % players.length;
    setCzarIndex(nextCzar);
    setRound(r => r + 1);
    dealRound();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "game") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Enter" && (phase === "play" || phase === "reveal")) {
        e.preventDefault();
        if (phase === "play") void submitPick();
        else confirmWinner();
      }
      if ((e.key === "n" || e.key === "N") && phase === "winner") {
        e.preventDefault();
        nextRound();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, phase, selectedCard, whiteCards, judgements, players, czarIndex, winScore]);

  function copyLog() {
    const lines = history.map(h =>
      `R${h.round} [${h.czar} as Czar]\n  Black: ${h.black}\n  White: "${h.white}" → ${h.winner}${h.verdict ? ` (${h.verdict})` : ""}`
    );
    const text = `VOID CARDS — ${history.length} rounds\n\n${lines.join("\n\n")}\n\nFinal: ${[...players].sort((a, b) => b.score - a.score).map(p => `${p.name} (${p.score})`).join(", ")}`;
    void navigator.clipboard?.writeText(text);
  }

  const inp = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" as const };
  const btnS = (col: string) => ({ padding: "7px 16px", borderRadius: 8, background: `color-mix(in srgb, ${col} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" as const });

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (screen === "setup") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.bg1}, ${C.bg2})`, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>}
          {onBack && <span style={{ color: C.border }}>|</span>}
          <span style={{ fontSize: 20 }}>⚫</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>VOID CARDS</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>A dark humor party game for deeply flawed people</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 12 }}>PLAYERS (2–8)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {players.map((p, i) => {
                const col = i === 0 ? C.primary : C.blue;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `color-mix(in srgb, ${col} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: col, fontWeight: 700 }}>{i + 1}</div>
                    <input value={p.name} onChange={e => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} style={{ ...inp, flex: 1 }} />
                    {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16 }}>×</button>}
                  </div>
                );
              })}
            </div>
            {players.length < 8 && (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()}
                  placeholder="Add player name..." style={{ ...inp, flex: 1 }} />
                <button onClick={addPlayer} style={{ padding: "8px 16px", borderRadius: 8, background: C.bg3, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, cursor: "pointer" }}>Add</button>
              </div>
            )}
            {setupError && <div style={{ marginTop: 8, fontSize: 11, color: "var(--danger)" }}>{setupError}</div>}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>DECK THEME (AI mode)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {DECK_THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme === t.id ? C.primary : C.border}`, background: theme === t.id ? "var(--crimson-soft)" : "transparent", color: theme === t.id ? C.primary : "var(--text-dim)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: theme === t.id ? 700 : 400 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>DARKNESS LEVEL</div>
              {DIFFICULTY.map(d => (
                <button key={d.id} onClick={() => setDifficulty(d.id)}
                  style={{ display: "block", width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${difficulty === d.id ? C.primary : "var(--border-soft)"}`, background: difficulty === d.id ? "var(--crimson-soft)" : "transparent", color: difficulty === d.id ? C.primary : "var(--text-dim)", fontSize: 12, cursor: "pointer", textAlign: "left", fontWeight: difficulty === d.id ? 700 : 400, marginBottom: 5 }}>
                  {d.label}
                  <div style={{ fontSize: 9, color: "var(--text-faint)" }}>{d.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>WIN CONDITION</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>First to</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[5, 7, 10, 15].map(n => (
                  <button key={n} onClick={() => setWinScore(n)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${winScore === n ? C.primary : C.border}`, background: winScore === n ? "var(--crimson-soft)" : "transparent", color: winScore === n ? C.primary : "var(--text-dim)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {n} ⚫
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 8 }}>CUSTOM CARDS</div>
                <button onClick={() => setShowDeckBuilder(b => !b)} style={btnS(C.primary)}>
                  {showDeckBuilder ? "Close Deck Builder" : "✏️ Deck Builder"}
                </button>
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <input id="timerOn" type="checkbox" checked={timerOn} onChange={e => setTimerOn(e.target.checked)} style={{ accentColor: C.primary }} />
                <label htmlFor="timerOn" style={{ fontSize: 11, color: "var(--text-dim)", cursor: "pointer" }}>60s round timer</label>
              </div>
            </div>
          </div>

          {showDeckBuilder && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 12 }}>CUSTOM DECK BUILDER</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6 }}>⚫ BLACK CARDS (prompts with ___)</div>
                  <textarea value={customBlackInput} onChange={e => setCustomBlackInput(e.target.value)}
                    placeholder={"One card per line. Use ___ for the blank.\ne.g. The real reason my marriage works: ___."}
                    style={{ ...inp, width: "100%", minHeight: 80, resize: "vertical", lineHeight: 1.5 }} />
                  <button onClick={() => { if (customBlackInput.trim()) { setCustomBlack(b => [...b, ...customBlackInput.split("\n").map(s => s.trim()).filter(Boolean)]); setCustomBlackInput(""); } }}
                    style={{ ...btnS(C.text), marginTop: 6 }}>Add Black Cards ({customBlack.length})</button>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 6 }}>⬜ WHITE CARDS (answers)</div>
                  <textarea value={customWhiteInput} onChange={e => setCustomWhiteInput(e.target.value)}
                    placeholder={"One answer per line.\ne.g. Weaponized passive aggression"}
                    style={{ ...inp, width: "100%", minHeight: 80, resize: "vertical", lineHeight: 1.5 }} />
                  <button onClick={() => { if (customWhiteInput.trim()) { setCustomWhite(w => [...w, ...customWhiteInput.split("\n").map(s => s.trim()).filter(Boolean)]); setCustomWhiteInput(""); } }}
                    style={{ ...btnS(C.text), marginTop: 6 }}>Add White Cards ({customWhite.length})</button>
                </div>
              </div>
              {(customBlack.length > 0 || customWhite.length > 0) && (
                <button onClick={() => { setCustomBlack([]); setCustomWhite([]); localStorage.removeItem("voidcards_black"); localStorage.removeItem("voidcards_white"); }}
                  style={{ ...btnS("var(--danger)"), marginTop: 12 }}>Clear Custom Deck</button>
              )}
            </div>
          )}

          <button onClick={startGame}
            style={{ width: "100%", padding: 16, borderRadius: 14, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer", letterSpacing: ".04em" }}>
            ⚫ DEAL THE VOID
          </button>
        </div>
      </div>

      <style>{`@keyframes cardPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );

  // ── RESULTS SCREEN ────────────────────────────────────────────────────────
  if (screen === "results") {
    const champion = [...players].sort((a, b) => b.score - a.score)[0];
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, background: C.bg1, overflowY: "auto" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>👑</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.primary, marginBottom: 4 }}>{champion.name} WINS</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>with {champion.score} black cards of pure darkness</div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, width: "100%", maxWidth: 420, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>FINAL SCORES</div>
          <Scoreboard players={players} czarIndex={-1} />
        </div>
        {history.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, width: "100%", maxWidth: 420, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>HALL OF SHAME</div>
              <button onClick={copyLog} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer" }}>copy log</button>
            </div>
            {history.slice(-6).map((h, i) => (
              <div key={i} style={{ marginBottom: 10, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
                <div style={{ fontSize: 10, color: "var(--text-faint)" }}>R{h.round} · {h.czar} as Czar</div>
                <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{h.black}</div>
                <div><span style={{ color: C.white }}>"{h.white}"</span> → <span style={{ color: C.primary }}>{h.winner}</span>
                  {h.verdict && <span style={{ color: VERDICT_COLOR[h.verdict] ?? "var(--danger)", marginLeft: 4 }}>({h.verdict})</span>}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setScreen("setup"); setHistory([]); }}
            style={{ padding: "12px 24px", borderRadius: 12, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
            New Game
          </button>
          {onBack && <button onClick={onBack} style={{ ...btnS(C.blue), padding: "12px 20px", borderRadius: 12 }}>← Back</button>}
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg1 }}>

      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border-soft)", background: "var(--card-alt)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>VOID CARDS</span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Round {round}</span>
        <span style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>⚖️ Czar: {czar?.name}</span>
        {timerOn && phase === "play" && (
          <span style={{ fontSize: 11, fontWeight: 700, color: timeLeft <= 10 ? "var(--danger)" : "var(--text-muted)" }}>⏱ {timeLeft}s</span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={aiGenerateRound} disabled={genLoading}
          style={{ ...btnS(C.primary), opacity: genLoading ? 0.5 : 1 }}>
          {genLoading ? "⚫ Generating..." : "🤖 AI Round"}
        </button>
        <button onClick={dealRound} style={btnS(C.blue)}>New Cards</button>
        <button onClick={nextRound} style={btnS(C.blue)}>Skip →</button>
        <button onClick={() => setScreen("setup")} style={btnS("var(--danger)")}>End</button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          <div style={{ maxWidth: 360, marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 8 }}>THIS ROUND'S PROMPT</div>
            <BlackCard text={blackCard} loading={genLoading} />
          </div>

          <div style={{ marginBottom: 14, padding: "8px 14px", borderRadius: 10, background: phase === "winner" ? "var(--crimson-soft)" : "rgba(255,255,255,0.04)", border: `1px solid ${phase === "winner" ? C.primary : "var(--border-soft)"}` }}>
            <div style={{ fontSize: 12, color: phase === "winner" ? C.primary : "var(--text-dim)", fontWeight: 600 }}>
              {phase === "play" && `${czar?.name} (Czar): Pick the funniest answer. Everyone else: choose your submission.`}
              {phase === "judging" && "The Czar is judging every card..."}
              {phase === "reveal" && "All cards judged. The Czar now locks in the winner."}
              {phase === "winner" && winner && `🏆 ${czar?.name} chose "${whiteCards[selectedCard ?? -1]?.text}" — ${winner.name} scores a black card!`}
            </div>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 10 }}>
            {phase === "play" && "SELECT A CARD:"}
            {phase === "judging" && "JUDGING ALL CARDS..."}
            {phase === "reveal" && "ALL JUDGED — LOCK IN THE WINNER:"}
            {phase === "winner" && "ROUND RESULTS:"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
            {whiteCards.map((card, i) => {
              const j = judgements[i];
              const player = players.find(p => p.id === card.playerId);
              const revealAll = phase === "reveal" || phase === "winner";
              return (
                <div key={i}>
                  {revealAll && player && (
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, textAlign: "center" }}>{player.name}</div>
                  )}
                  <WhiteCard
                    text={card.text}
                    selected={selectedCard === i}
                    onClick={() => phase === "play" || phase === "reveal" ? setSelectedCard(i) : undefined}
                    disabled={phase === "judging" || phase === "winner"}
                    revealed={revealAll}
                    score={revealAll ? j?.score : undefined}
                    verdict={revealAll ? j?.verdict : undefined}
                    reaction={phase === "winner" && selectedCard === i ? j?.reaction : undefined}
                    highlightWinner={phase === "winner" && selectedCard === i}
                  />
                </div>
              );
            })}
          </div>

          {phase === "play" && (
            <button onClick={submitPick} disabled={selectedCard === null}
              style={{ padding: "12px 28px", borderRadius: 12, background: selectedCard !== null ? "var(--grad-crimson)" : C.bg3, border: "none", color: selectedCard !== null ? "#fff" : "var(--text-faint)", fontSize: 13, fontWeight: 800, cursor: selectedCard !== null ? "pointer" : "not-allowed" }}>
              🤖 Send All Cards to the Czar
            </button>
          )}
          {phase === "judging" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.primary, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary, animation: "cardPulse 1.2s ease-in-out infinite" }} />
              Judging...
            </div>
          )}
          {phase === "reveal" && (
            <button onClick={confirmWinner} disabled={selectedCard === null}
              style={{ padding: "12px 28px", borderRadius: 12, background: selectedCard !== null ? "var(--grad-crimson)" : C.bg3, border: "none", color: selectedCard !== null ? "#fff" : "var(--text-faint)", fontSize: 13, fontWeight: 800, cursor: selectedCard !== null ? "pointer" : "not-allowed" }}>
              ⚖️ Lock In Winner (Enter)
            </button>
          )}
          {phase === "winner" && (
            <button onClick={nextRound}
              style={{ padding: "12px 28px", borderRadius: 12, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              Next Round → (N)
            </button>
          )}
        </div>

        <div style={{ width: 180, flexShrink: 0, borderLeft: "1px solid var(--border-soft)", padding: 14, overflowY: "auto", background: "var(--card-alt)" }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 10 }}>SCOREBOARD</div>
          <Scoreboard players={players} czarIndex={czarIndex} />

          <div style={{ marginTop: 16, padding: "8px 10px", background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: C.primary, fontWeight: 700, marginBottom: 2 }}>WIN CONDITION</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{winScore} ⚫ to win</div>
          </div>

          {history.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 8 }}>LAST PICKS</div>
              {history.slice(-3).reverse().map((h, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 10, color: "var(--text-faint)", lineHeight: 1.4 }}>
                  <div style={{ color: "var(--text-dim)", fontStyle: "italic" }}>"{h.white.slice(0, 40)}{h.white.length > 40 ? "..." : ""}"</div>
                  <div style={{ color: C.primary }}>→ {h.winner}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes cardPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}