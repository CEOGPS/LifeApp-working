// PATCH NOTES (erebus-dock-redesign, 2026-09-29)
//   Redesigned dock. Kept: the ✨ toggle, the quick chat (message list + input),
//   the ⤢ "Full Erebus panel" button/overlay, the settings gear, Escape to close.
//   Added:
//   - Avatar window: the ONE live Erebus avatar (ErebusFace + skins + idle
//     motion), shared with the center AI stage, floating window and PiP
//     (src/lib/agents/erebus/dock/AvatarHost.tsx).
//   - Voice controls (mute, Kokoro voice, speed, volume, test; push-to-talk on
//     the avatar), skin switching, placement (stage / dock / float), Detach.
//   - Modes: Chat, Writer, Image, Sound, Video (dock/ModePanels.tsx).
//   - AI Hub settings link (/agents).
//   Fixed: quick chat posted to "/api/llm", which does not exist (and the
//   worker's /api/llm/invoke only returns a mock). It now goes through Chris's
//   stack: Erebus backend -> Ollama -> NVIDIA (dock/erebusStack.ts). The
//   settings checkboxes were uncontrolled no-ops; they are now real settings
//   saved to Supabase. The mic button had no handler; it is push-to-talk now.
//   The panel sat under the ✨ toggle (z-50), which covered the Send button;
//   it now opens above the toggle (bottom-24).
// PATCH NOTES (erebus-blockers, 2026-09-29)
//   A "Full Erebus panel" button opens the full erebus/ui/ErebusPanel in a
//   large overlay, lazy-loaded so the dock stays light.
import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Mic, Send, Settings, Sparkles, Loader2, Maximize2, SlidersHorizontal,
  PictureInPicture2, LayoutPanelTop, PanelRight, Move, MessageSquare, PenLine, Image as ImageIcon, AudioLines, Film,
} from "lucide-react";
import AvatarHost, { pipSupported } from "@/lib/agents/erebus/dock/AvatarHost";
import AvatarSlot from "@/lib/agents/erebus/dock/AvatarSlot";
import FloatWindow from "@/lib/agents/erebus/dock/FloatWindow";
import VoiceBar from "@/lib/agents/erebus/dock/VoiceBar";
import { WriterMode, ImageMode, SoundMode, VideoMode } from "@/lib/agents/erebus/dock/ModePanels";
import { useDockStore, type DockMode, type Placement } from "@/lib/agents/erebus/dock/dockStore";
import { DOCK_SKINS } from "@/lib/agents/erebus/dock/skins";
import { getStackStatus, type StackStatus } from "@/lib/agents/erebus/dock/erebusStack";
import { useSpeechInput } from "@/lib/agents/erebus/dock/useSpeechInput";

// PATCH (erebus-blockers): full Erebus panel, loaded on demand.
const ErebusPanel = lazy(() => import("@/lib/agents/erebus/ui/ErebusPanel"));

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const MODES: { id: DockMode; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "writer", label: "Writer", icon: PenLine },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "sound", label: "Sound", icon: AudioLines },
  { id: "video", label: "Video", icon: Film },
];

const PLACEMENTS: { id: Placement; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "stage", label: "Center stage", icon: LayoutPanelTop },
  { id: "dock", label: "In dock", icon: PanelRight },
  { id: "float", label: "Floating", icon: Move },
];

const SUGGESTIONS = ["Plan my day", "Summarize what I should focus on", "Draft a follow-up email", "Give me 3 content ideas"];

function stackLabel(st: StackStatus | null): { text: string; ok: boolean | null } {
  if (!st) return { text: "checking…", ok: null };
  if (st.backend === "real") return { text: "Erebus backend", ok: true };
  if (st.ollama) return { text: `Ollama · ${st.ollamaModel}`, ok: true };
  if (st.nvidia) return { text: "NVIDIA", ok: true };
  return { text: "no AI backend online", ok: false };
}

export function ErebusDock() {
  const isOpen = useDockStore((s) => s.dockOpen);
  const setIsOpen = useDockStore((s) => s.setDockOpen);
  const messages = useDockStore((s) => s.messages);
  const isLoading = useDockStore((s) => s.sending);
  const sendChat = useDockStore((s) => s.sendChat);
  const clearChat = useDockStore((s) => s.clearChat);
  const settings = useDockStore((s) => s.settings);
  const update = useDockStore((s) => s.update);
  const saveState = useDockStore((s) => s.saveState);
  const pipWindow = useDockStore((s) => s.pipWindow);
  const activeTarget = useDockStore((s) => s.activeTarget);
  const detachFn = useDockStore((s) => s.detachFn);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  // PATCH (erebus-blockers): full ErebusPanel overlay
  const [showFullPanel, setShowFullPanel] = useState(false);
  const [stack, setStack] = useState<StackStatus | null>(null);
  const navigate = useNavigate();

  const chatMic = useSpeechInput((text) => void sendChat(text));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, settings.mode]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    getStackStatus(true).then((s) => alive && setStack(s));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;
    setInput("");
    await sendChat(msg);
  };

  const sl = stackLabel(stack);
  const headerBtn = "p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10";

  return (
    <>
      <AvatarHost />
      <FloatWindow />

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl",
          isOpen
            ? "bg-primary text-primary-foreground rotate-45"
            : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
        )}
        aria-label={isOpen ? "Close Erebus" : "Open Erebus"}
      >
        <Sparkles size={28} />
      </button>

      {/* Dock panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] max-w-[440px] h-[780px] max-h-[calc(100vh-7.5rem)] glass rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-slide-up"
          data-testid="erebus-dock"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold leading-tight">Erebus</h3>
                <p className="text-[10px] text-white/40 font-display tracking-widest uppercase flex items-center gap-1 truncate">
                  <span className={cn("w-1.5 h-1.5 rounded-full", sl.ok ? "bg-emerald-400" : sl.ok === false ? "bg-red-400" : "bg-white/30")} />
                  {sl.text}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <button onClick={() => navigate("/agents")} className={headerBtn} aria-label="AI Hub settings" title="AI Hub settings">
                <SlidersHorizontal size={17} />
              </button>
              <button
                onClick={() => void detachFn?.()}
                className={cn(headerBtn, pipWindow && "text-primary")}
                aria-label={pipWindow ? "Return Erebus" : "Detach Erebus"}
                title={pipWindow ? "Return Erebus to the page" : pipSupported() ? "Detach: always-on-top window (Chrome/Edge)" : "Detach: floating window"}
              >
                <PictureInPicture2 size={17} />
              </button>
              <button
                onClick={() => {
                  setShowFullPanel(true);
                  setIsOpen(false);
                }}
                className={headerBtn}
                aria-label="Full Erebus panel"
                title="Full Erebus panel (voice, face, presence)"
              >
                <Maximize2 size={17} />
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={cn(headerBtn, showSettings && "text-white bg-white/10")} aria-label="Settings">
                <Settings size={17} />
              </button>
              <button onClick={() => setIsOpen(false)} className={headerBtn} aria-label="Close">
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Settings panel (all saved to Supabase) */}
          {showSettings && (
            <div className="p-3 border-b border-white/10 bg-white/5 text-sm" data-testid="erebus-settings">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={settings.autoOpen} onChange={(e) => update({ autoOpen: e.target.checked })} />
                  <span>Auto-open on new messages</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={settings.voiceInput} onChange={(e) => update({ voiceInput: e.target.checked })} />
                  <span>Voice input enabled</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={settings.proactive} onChange={(e) => update({ proactive: e.target.checked })} />
                  <span>Proactive suggestions</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={settings.autoSpeak} onChange={(e) => update({ autoSpeak: e.target.checked })} />
                  <span>Speak replies</span>
                </label>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={clearChat} className="flex-1 px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30">
                  Clear conversation history
                </button>
                <span className="text-[10px] text-white/40 w-24 text-right">
                  {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to Supabase" : saveState === "error" ? "Save failed" : ""}
                </span>
              </div>
            </div>
          )}

          {/* Avatar window */}
          <div className="border-b border-white/10 bg-black/30 px-3 pt-2 pb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex gap-1" role="radiogroup" aria-label="Skin">
                {DOCK_SKINS.map((s) => (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={settings.skin === s.id}
                    onClick={() => update({ skin: s.id, skinChosen: true })}
                    title={s.label}
                    className={cn(
                      "w-5 h-5 rounded-full border transition-transform",
                      settings.skin === s.id ? "border-white scale-110" : "border-white/20 hover:scale-105"
                    )}
                    style={{ background: `radial-gradient(circle at 40% 35%, rgb(${s.auraRgb}), ${s.background})` }}
                  />
                ))}
              </div>
              <div className="flex gap-0.5" role="radiogroup" aria-label="Avatar placement">
                {PLACEMENTS.map((p) => (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={settings.placement === p.id}
                    onClick={() => update({ placement: p.id })}
                    title={p.label}
                    className={cn("p-1.5 rounded-md", settings.placement === p.id ? "bg-primary/25 text-white" : "text-white/40 hover:text-white hover:bg-white/10")}
                  >
                    <p.icon size={13} />
                  </button>
                ))}
              </div>
            </div>
            <AvatarSlot
              name="dock"
              size={124}
              placeholder={
                <div className="h-10 flex items-center justify-center gap-2 text-[11px] text-white/40">
                  {/* PATCH (home-page2): the home page's centre window is another avatar slot */}
                  {pipWindow ? "Erebus is detached." : activeTarget === "home" ? "Erebus is on the home page." : settings.placement === "stage" ? "Erebus is on the center stage." : "Erebus is floating."}
                  <button onClick={() => (pipWindow ? pipWindow.close() : update({ placement: "dock" }))} className="underline hover:text-white">
                    Bring here
                  </button>
                </div>
              }
            />
          </div>

          <VoiceBar kokoroOnline={stack ? stack.kokoro : null} />

          {/* Mode tabs */}
          <div className="flex border-b border-white/10" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={settings.mode === m.id}
                onClick={() => update({ mode: m.id })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-display tracking-wider uppercase border-b-2",
                  settings.mode === m.id ? "border-primary text-white" : "border-transparent text-white/40 hover:text-white/70"
                )}
              >
                <m.icon size={12} /> {m.label}
              </button>
            ))}
          </div>

          {settings.mode === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 140 }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40 text-center py-6">
                    <p className="font-medium text-white/60">Hey! I'm Erebus.</p>
                    <p className="text-sm text-white/30 mt-1">Ask me anything about your dashboard, data, or just chat.</p>
                    {settings.proactive && (
                      <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                        {SUGGESTIONS.map((s) => (
                          <button key={s} onClick={() => void handleSend(s)} className="px-2 py-1 rounded-full border border-white/10 text-[11px] text-white/60 hover:text-white hover:bg-white/10">
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={cn("flex animate-fade-in", msg.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 max-w-[85%]",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : msg.error
                              ? "bg-amber-500/10 border border-amber-500/20 text-amber-100 rounded-tl-none"
                              : "bg-white/10 text-white rounded-tl-none"
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[9px] opacity-50 mt-1 text-right">
                          {msg.via ? `${msg.via} · ` : ""}
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex items-end gap-2">
                  <button
                    className={cn(
                      "p-2 rounded-lg flex-shrink-0 disabled:opacity-40",
                      chatMic.listening ? "bg-cyan-500/25 text-cyan-200" : "text-white/50 hover:text-white hover:bg-white/10"
                    )}
                    aria-label="Voice input (hold to talk)"
                    title={!chatMic.supported ? "Speech input needs Chrome/Edge" : !settings.voiceInput ? "Voice input is off in settings" : "Hold to talk"}
                    disabled={!settings.voiceInput || !chatMic.supported}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      chatMic.start();
                    }}
                    onPointerUp={() => chatMic.stop()}
                    onPointerLeave={() => chatMic.listening && chatMic.stop()}
                  >
                    <Mic size={18} />
                  </button>
                  <div className="flex-1 relative">
                    <input
                      id="erebus-input"
                      type="text"
                      value={chatMic.listening ? chatMic.interim : input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void handleSend())}
                      placeholder={chatMic.listening ? "Listening…" : "Ask Erebus..."}
                      disabled={isLoading}
                      className="w-full h-10 pl-4 pr-10 py-0 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 text-sm"
                    />
                    <button
                      onClick={() => void handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
                {(isLoading || chatMic.error) && (
                  <div className="flex items-center gap-2 text-[10px] text-white/40 mt-2">
                    {isLoading && <Loader2 size={12} className="animate-spin" />}
                    <span>{isLoading ? "Erebus is thinking..." : chatMic.error}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {settings.mode === "writer" && <WriterMode />}
              {settings.mode === "image" && <ImageMode />}
              {settings.mode === "sound" && <SoundMode />}
              {settings.mode === "video" && <VideoMode />}
            </div>
          )}
        </div>
      )}

      {/* PATCH (erebus-blockers): full Erebus panel overlay */}
      {showFullPanel && (
        <div className="fixed top-4 left-4 right-4 bottom-24 sm:top-8 sm:left-8 sm:right-8 z-40 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col bg-[#07080f]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <span className="font-display text-sm font-semibold">Erebus</span>
            </div>
            <button
              onClick={() => setShowFullPanel(false)}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              aria-label="Close full Erebus panel"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center text-white/40 text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading Erebus...
                </div>
              }
            >
              <ErebusPanel />
            </Suspense>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
