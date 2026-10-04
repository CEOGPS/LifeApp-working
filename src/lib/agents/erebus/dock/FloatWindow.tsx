// Circular call window with the dock chat attached. Stays on screen across pages.
import { useState } from "react";
import { motion, useDragControls, useMotionValue } from "motion/react";
import { Send, X } from "lucide-react";
import AvatarSlot from "./AvatarSlot";
import { useDockStore } from "./dockStore";

export default function FloatWindow() {
  const placement = useDockStore((s) => s.settings.placement);
  const pos = useDockStore((s) => s.settings.floatPos);
  const messages = useDockStore((s) => s.messages);
  const sending = useDockStore((s) => s.sending);
  const sendChat = useDockStore((s) => s.sendChat);
  const pip = useDockStore((s) => s.pipWindow);
  const update = useDockStore((s) => s.update);
  const [text, setText] = useState("");
  const drag = useDragControls();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  if (placement !== "float" || pip) return null;

  const parked = pos.x === 24 && pos.y === 120;
  const left = parked ? Math.max(16, window.innerWidth - 340) : pos.x;
  const top = parked ? Math.max(16, window.innerHeight - 560) : pos.y;
  const name = "Nova";
  const recent = messages.slice(-4);

  const submit = () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setText("");
    void sendChat(msg);
  };

  return (
    <motion.div
      drag
      dragControls={drag}
      dragListener={false}
      dragMomentum={false}
      initial={false}
      onDragEnd={(_, info) => {
        const x = Math.max(8, Math.min(window.innerWidth - 300, left + info.offset.x));
        const y = Math.max(8, Math.min(window.innerHeight - 180, top + info.offset.y));
        update({ floatPos: { x, y } });
        mx.set(0);
        my.set(0);
      }}
      style={{ left, top, x: mx, y: my, width: 300 }}
      className="fixed z-[60]"
      data-testid="erebus-float"
    >
      <style>{`
        [data-avatar-slot="float"] [data-testid="erebus-avatar-controls"] { display: none; }
      `}</style>
      <div className="flex flex-col items-center">
        <div
          onPointerDown={(e) => drag.start(e)}
          className="relative h-[228px] w-[228px] cursor-grab active:cursor-grabbing"
        >
          <div className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(56,150,255,0.35),transparent_68%)]" />
          <div className="relative h-full w-full overflow-hidden rounded-full border border-sky-300/40 bg-black shadow-[0_0_0_6px_rgba(0,0,0,0.65),0_0_32px_rgba(56,150,255,0.35)]">
            <AvatarSlot name="float" size={228} />
          </div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-sky-300/30 bg-black/70 px-2.5 py-1 text-[11px] text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
            {name}
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => update({ placement: "dock" })}
            className="absolute right-1 top-1 rounded-full border border-white/15 bg-black/70 p-1 text-white/70 hover:text-white"
            aria-label="Put the call back in the dock"
            title="Back to dock"
          >
            <X size={12} />
          </button>
        </div>

        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-3 w-full rounded-[24px] border border-sky-300/25 bg-black/80 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <div className="max-h-36 space-y-1.5 overflow-y-auto px-1 py-1">
            {recent.length === 0 && (
              <p className="px-1 py-2 text-center text-[11px] text-white/40">Ask {name} anything.</p>
            )}
            {recent.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-2xl rounded-br-md bg-sky-400/20 px-2.5 py-1.5 text-[12px] text-white"
                    : "mr-6 rounded-2xl rounded-bl-md bg-white/10 px-2.5 py-1.5 text-[12px] text-white/85"
                }
              >
                {m.content}
              </div>
            ))}
          </div>
          <form
            className="mt-1 flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message"
              className="h-9 flex-1 rounded-full border border-white/10 bg-white/5 px-3 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-sky-300/50"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-400/80 text-black disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
