// src/pages/dashboard/_components/ErebusHomeStage.tsx
// PATCH (home-page2): centre column of the home page. Erebus stands TALL inside a
// glowing vertical capsule window (like Chris's reference), with her latest reply,
// a quick ask box (same quick chat as the dock) and the saved-keys status.
// The live avatar is the single app-wide AvatarHost node, moved into the "home"
// slot, so voice/mouth/glow, the dock and Detach (PiP) keep working.
// PATCH (blue-theme): capsule/pill window removed. Erebus now lives in a standard
// rectangular <Module> card (same card style/radius/header as the other panels);
// the cyan hologram glow (halo, scanlines, projector base, drop-shadow) stays on her image.
// PATCH (home-agent-short): shorter stage so chat input/reply stay usable without cutoff;
// border removed (glow-only module); idle bounce cut at AvatarHost (static until video).
import { useState } from "react";
import { Send, Loader2, MessageSquare, Bot } from "lucide-react";
import { useDockStore } from "@/lib/agents/erebus/dock/dockStore";
import SavedKeysPanel from "./SavedKeysPanel";
import Module from "./Module";

const CYAN = "70,200,255";

export default function ErebusHomeStage() {
  const activity = useDockStore((s) => s.activity);
  const sending = useDockStore((s) => s.sending);
  const sendChat = useDockStore((s) => s.sendChat);
  const setDockOpen = useDockStore((s) => s.setDockOpen);
  const pip = useDockStore((s) => s.pipWindow);
  const active = useDockStore((s) => s.activeTarget === "home");
  const lastReply = useDockStore((s) => [...s.messages].reverse().find((m) => m.role === "assistant"));
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    void sendChat(t);
  };

  const speaking = activity === "speaking";
  const glow = speaking ? 0.75 : activity === "listening" ? 0.6 : activity === "thinking" ? 0.45 : 0.3;
  const status =
    activity === "speaking" ? "Speaking" : activity === "listening" ? "Listening…" : activity === "thinking" ? "Thinking…" : "Online";

  return (
    <Module
      title="Kranos"
      icon={<Bot size={13} />}
      accent
      className="module-card--glow-only w-full xl:h-[560px]"
      headerRight={
        <div className="flex items-center gap-1.5 text-[9px] font-display tracking-widest uppercase" style={{ color: `rgba(${CYAN},0.85)` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${CYAN})`, boxShadow: `0 0 8px rgb(${CYAN})` }} />
          {active ? status : pip ? "Detached" : "Docked"}
        </div>
      }
    >
    <section className="h-full flex flex-col items-stretch gap-2 min-h-0" aria-label="Erebus" data-testid="erebus-home">
      {/* Hologram stage: shorter; glow only (no hard border on outer module) */}
      <div
        className="relative w-full flex-1 min-h-0 rounded-[10px] overflow-hidden flex flex-col items-center justify-center pt-2 pb-3"
        style={{
          minHeight: 220,
          maxHeight: 300,
          background: `radial-gradient(ellipse at 50% 40%, rgba(${CYAN},0.16), rgba(2,8,20,0.55) 60%, rgba(1,3,9,0.35) 100%)`,
          boxShadow: `inset 0 0 ${24 + glow * 36}px rgba(${CYAN},${0.1 + glow * 0.25})`,
          transition: "box-shadow 300ms ease",
        }}
        data-testid="erebus-home-window"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `repeating-linear-gradient(0deg, rgba(${CYAN},0.05) 0 1px, transparent 1px 4px)` }} />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full" style={{ width: 200, height: 200, border: `1px solid rgba(${CYAN},0.18)`, boxShadow: `0 0 ${20 + glow * 30}px rgba(${CYAN},${0.12 + glow * 0.2})` }} />
        <div aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-[50%]" style={{ width: 150, height: 20, background: `radial-gradient(ellipse, rgba(${CYAN},0.55), transparent 70%)`, filter: "blur(2px)" }} />

        <div className="relative z-[1] flex flex-col items-center">
          <div className="relative h-[210px] w-[210px]">
            <div className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(210,180,90,0.28),transparent_68%)]" />
            <div className="h-full w-full overflow-hidden rounded-full border border-sky-300/40 bg-black shadow-[0_0_0_6px_rgba(0,0,0,0.55),0_0_28px_rgba(56,150,255,0.28)]">
              <video
                src="/agents/avatars/nyx.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-sky-300/30 bg-black/70 px-2.5 py-1 text-[11px] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
              Kranos
            </div>
          </div>
        </div>
      </div>

      {/* Latest reply — clamped so input stays visible */}
      <div className="w-full shrink-0 rounded-xl px-3 py-2 text-sm text-white/80 whitespace-pre-wrap line-clamp-3 min-h-[2.5rem] max-h-[4.5rem] overflow-hidden" style={{ background: "rgba(4,10,22,0.65)", boxShadow: `inset 0 0 0 1px rgba(${CYAN},0.2)` }} aria-live="polite">
        {sending ? (
          <span className="flex items-center gap-2 text-white/45">
            <Loader2 size={12} className="animate-spin" /> Kranos is thinking…
          </span>
        ) : lastReply ? (
          lastReply.content
        ) : (
          <span className="text-white/45">Kranos is here. Ask from this card, or talk to Erebus in the circle.</span>
        )}
      </div>

      {/* Quick ask — always visible at bottom of card */}
      <div className="w-full shrink-0 flex gap-1.5">
        <div className="relative flex-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
            placeholder="Ask Kranos…"
            disabled={sending}
            className="w-full h-9 pl-3 pr-9 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-300/50"
            aria-label="Ask Kranos"
          />
          <button type="button" onClick={submit} disabled={!text.trim() || sending} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40" aria-label="Send">
            <Send size={14} />
          </button>
        </div>
        <button type="button" onClick={() => setDockOpen(true)} className="h-9 w-9 flex items-center justify-center rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/10" title="Open the dock (chat, writer, image, sound, video)" aria-label="Open Erebus dock">
          <MessageSquare size={14} />
        </button>
      </div>

      <div className="w-full shrink-0">
        <SavedKeysPanel />
      </div>
    </section>
    </Module>
  );
}
