// src/lib/agents/erebus/dock/AIStage.tsx
// Center "AI stage" shown at the top of every page (AppLayout) when the
// avatar placement is "stage". Holds the shared live avatar slot, the latest
// Erebus reply and a quick ask box wired to the same quick chat as the dock.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, MessageSquare, SlidersHorizontal, ChevronUp, Loader2 } from "lucide-react";
import AvatarSlot from "./AvatarSlot";
import { useDockStore } from "./dockStore";

export default function AIStage() {
  const placement = useDockStore((s) => s.settings.placement);
  const pip = useDockStore((s) => s.pipWindow);
  const update = useDockStore((s) => s.update);
  const sending = useDockStore((s) => s.sending);
  const sendChat = useDockStore((s) => s.sendChat);
  const setDockOpen = useDockStore((s) => s.setDockOpen);
  const lastReply = useDockStore((s) => [...s.messages].reverse().find((m) => m.role === "assistant"));
  const [text, setText] = useState("");
  const navigate = useNavigate();

  if (placement !== "stage") return null;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    void sendChat(t);
  };

  return (
    <section
      className="relative mx-auto mb-4 max-w-3xl glass rounded-2xl border border-primary/20 px-4 py-3 flex items-center gap-4 shadow-[0_0_30px_rgba(70,190,255,0.10)]"
      aria-label="Erebus AI stage"
      data-testid="erebus-stage"
    >
      <AvatarSlot
        name="stage"
        size={104}
        className="shrink-0"
        placeholder={
          <div className="w-[104px] h-[156px] rounded-xl border border-dashed border-white/10 flex items-center justify-center text-center text-[10px] text-white/30 px-2">
            {pip ? "Erebus is detached" : "Erebus is in the dock"}
          </div>
        }
      />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm tracking-widest uppercase text-primary">Erebus</span>
          <span className="text-[10px] text-white/30 truncate">{lastReply?.via ? `via ${lastReply.via}` : "AI companion"}</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setDockOpen(true)} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10" title="Open the dock (chat, writer, image, sound, video)" aria-label="Open Erebus dock">
              <MessageSquare size={14} />
            </button>
            <button type="button" onClick={() => navigate("/agents")} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10" title="AI Hub settings" aria-label="AI Hub settings">
              <SlidersHorizontal size={14} />
            </button>
            <button type="button" onClick={() => update({ placement: "dock" })} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10" title="Hide stage (avatar moves to the dock)" aria-label="Hide stage">
              <ChevronUp size={14} />
            </button>
          </div>
        </div>
        <div className="text-sm text-white/80 line-clamp-3 min-h-[2.5rem] whitespace-pre-wrap" aria-live="polite">
          {sending ? (
            <span className="flex items-center gap-2 text-white/40">
              <Loader2 size={12} className="animate-spin" /> Erebus is thinking…
            </span>
          ) : lastReply ? (
            lastReply.content
          ) : (
            <span className="text-white/40">Hey Chris. Ask me anything, or hold the mic to talk.</span>
          )}
        </div>
        <div className="relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
            placeholder="Ask Erebus…"
            disabled={sending}
            className="w-full h-9 pl-3 pr-9 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
            aria-label="Ask Erebus from the stage"
          />
          <button type="button" onClick={submit} disabled={!text.trim() || sending} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/20 disabled:opacity-40" aria-label="Send">
            <Send size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
